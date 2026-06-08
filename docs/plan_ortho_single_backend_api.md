# Plan: Move Ortho 一鍵處理 to Single Backend API

## Context

The ortho auto-processing pipeline (`runOrthoAutoProcessing`) currently orchestrates ~19 HTTP requests between frontend and backend: create job, upload STL, generate hollow (async+poll), extend bottom, generate hex grid, download hex STL, generate drain holes, download drain STL, generate side wall drains (frontend-only), then 4 boolean operations (each: upload 2 blobs, poll, download result).

**Goal:** Collapse this into a single `POST` + poll + download pattern. All geometry generation and boolean operations run server-side. Frontend just uploads, polls progress, and downloads the final STL.

---

## Implementation Order

### Phase 1: Backend — New Pydantic Model

**File:** `/Users/max/repo_claude/web_slicer_core/agent/models.py`

Add `V2OrthoAutoProcessRequest`:
```python
class V2OrthoAutoProcessRequest(BaseModel):
    hollowing_min_thickness: float = 3.0
    hollowing_quality: float = 0.5
    hollowing_closing_distance: float = 2.0
    bottom_z_threshold: float = 0.5
    extension_distance: float = 10.0
    hex_cell_radius: float = 5.0
    hex_wall_thickness: float = 1.0
    hex_grid_count: int = 10
    hex_pyramid_height: float = 3.0
    hex_fallback_height: float = 20.0
    drain_hole_radius: float = 1.5
```

### Phase 2: Backend — Extend `write_job_status` for step progress

**File:** `/Users/max/repo_claude/web_slicer_core/agent/jobs.py`

Add optional `ortho_step`, `ortho_message`, `ortho_total_steps` params to `write_job_status()`. Include them in the status JSON when set. The existing `GET /api/v2/slices/{job_id}` endpoint already reads from `status.json` and returns it via `V2Response.data`, so these new fields will appear in the polling response automatically.

### Phase 3: Backend — New `ortho_pipeline.py` (core work)

**New file:** `/Users/max/repo_claude/web_slicer_core/agent/ortho_pipeline.py`

Contains two main functions:

#### 3a. `run_ortho_auto_process(job_id, request)` — async orchestrator

Steps:
1. **Hollow + extend bottom** — call `generate_hollow()` (PrusaSlicer CLI, async), then inline the extend-bottom logic (same as `api_v2.py:484-544`)
2. **Align hollow** — load hollow with trimesh, translate to input model center (`input_center = (bounds[0] + bounds[1]) / 2`), save as `model_hollow_aligned.stl`
3. **Generate hex grid** — call existing `generate_hex_grid()` from `sla_operations.py`, passing the aligned hollow mesh
4. **Generate drain holes** — call existing `generate_drain_holes()` from `sla_operations.py`
5. **Generate side wall drains** — call new `generate_side_wall_drains()` (see 3b below)
6. **Boolean #1:** `union(hex_grid, drain_holes)` — call `boolean_operation()` from `sla_operations.py`
7. **Boolean #2:** `intersection(flipped_hollow, step6_result)` — flip via `trimesh.invert()`, then `boolean_operation()`
8. **Boolean #3:** `union(sidewall_drains, step7_result)` — skip if no sidewall drains
9. **Boolean #4:** `difference(original_model, step8_result)` — final result saved as `ortho_final.stl`

Each step calls `write_job_status(job_id, PROCESSING, ortho_step=N, ortho_message="...")` for frontend progress polling.

Reuses existing functions:
- `generate_hollow()` from `sla_operations.py:301` (async, PrusaSlicer CLI)
- `parse_binary_stl()` / `write_binary_stl()` from `sla_operations.py` (extend bottom)
- `generate_hex_grid()` from `sla_operations.py:874`
- `generate_drain_holes()` from `sla_operations.py:776`
- `boolean_operation()` from `sla_operations.py:670`

#### 3b. `generate_side_wall_drains()` — Python port of `drillService.js:219-503`

Algorithm (ported from JS to Python/trimesh):

1. **Slice meshes** — use `trimesh.section(plane_origin, plane_normal)` → `to_planar()` → `polygons_full` (shapely Polygons). This replaces the manual 500-line `sliceMeshAtZ_World()` JS function.
   - Inner shell: slice at `bottom_z`
   - Outer shell: slice at `bottom_z + 1.0` (fallback: +0.5, +2.0)
   - Pick largest polygon by area from each

2. **Resample outer polygon** — uniform arc-length sampling at 360 points using `np.searchsorted` on cumulative segment lengths

3. **Angular binning** — assign 360 samples to 12 bins by angle from centroid

4. **Evaluate + slide search** — for each bin candidate:
   - Compute outward normal (perpendicular to tangent)
   - Ray-cast from outer → inner polygon segments to find wall crossing distance
   - Validate: `0.6*T ≤ distance ≤ 3.0*T`
   - Score hex wall hits (lower = better placement)
   - Slide ±5 steps to find best scoring position

5. **Spacing check** — min 6mm between drain centers

6. **Build 3D cylinders** — `trimesh.creation.cylinder()` with rotation transform, merge all via `trimesh.util.concatenate()`

Port these pure-math helpers from `geoUtils.js`:
- `point_in_polygon_2d()` — ray-casting algorithm
- `ray_seg_intersect_2d()` — parametric intersection (Cramer's rule)

### Phase 4: Backend — New API endpoint

**File:** `/Users/max/repo_claude/web_slicer_core/agent/api_v2.py`

Add `POST /slices/{job_id}/ortho-auto-process`:
- Validates job exists (pending or on disk)
- Flushes pending job to disk if needed (same pattern as `generate_hollow` endpoint)
- Launches `background_tasks.add_task(run_ortho_auto_process, job_id, request)`
- Returns `V2Response(success=True, data={"jobId": job_id})`

### Phase 5: Backend — File serving endpoints

**File:** `/Users/max/repo_claude/web_slicer_core/agent/main.py`

Add two `FileResponse` endpoints:
- `GET /api/jobs/{job_id}/ortho_final.stl` — serves `output/ortho_final.stl`
- `GET /api/jobs/{job_id}/sidewall_drains.stl` — serves `output/model_sidewall_drains.stl`

### Phase 6: Frontend — New backend service functions

**File:** `src/axios/backendService.js`

Add:
- `startOrthoAutoProcess(jobId, params)` — POST to the new endpoint
- `getOrthoFinalStl(jobId)` — GET the final STL blob

### Phase 7: Frontend — Rewrite `orthoAutoProcessingService.js`

**File:** `src/services/ortho/orthoAutoProcessingService.js`

Replace the current 335-line multi-step orchestrator with ~80 lines:
1. `createJob()` + `uploadModel()` (upload the baked-transform STL)
2. `startOrthoAutoProcess(jobId, orthoParams)` (trigger backend pipeline)
3. Poll `getJobStatus(jobId)` every 500ms until completed/failed
   - On each poll: call `onProgress(data.ortho_step, data.ortho_message)`
4. `getOrthoFinalStl(jobId)` → return final blob
5. Timeout: 5 minutes

Remove: `flipSTLFaces`, `meshToBlob`, `runBoolean`, `waitForBooleanStl`, all polling helpers, `generateSideWallDrains` import.

Keep the same function signature (`runOrthoAutoProcessing({selectedObject, stlBlob, modelId, orthoParams, ...})`) so callers (`OrthoProcessingEditor.vue`, `sceneCoordinator.js`) need no changes.

### Phase 8: Frontend — Minor UI adjustment

**File:** `src/components/features/model_control/OrthoProcessingEditor.vue`

- Preview meshes: skip for now (backend saves them to `output/` for future use). The `onPreviewMeshes` callback becomes a no-op. Can be re-enabled in a future phase by lazily downloading intermediate STLs.

---

## Files Changed Summary

| File | Change | Size |
|------|--------|------|
| `web_slicer_core/agent/models.py` | Add `V2OrthoAutoProcessRequest` | ~15 lines |
| `web_slicer_core/agent/jobs.py` | Extend `write_job_status()` with ortho progress fields | ~10 lines |
| `web_slicer_core/agent/ortho_pipeline.py` | **NEW** — orchestrator + side wall drains port | ~300 lines |
| `web_slicer_core/agent/api_v2.py` | Add ortho-auto-process endpoint | ~40 lines |
| `web_slicer_core/agent/main.py` | Add file serving endpoints | ~20 lines |
| `DS-Online/src/axios/backendService.js` | Add 2 new API functions | ~25 lines |
| `DS-Online/src/services/ortho/orthoAutoProcessingService.js` | Rewrite (335 → ~80 lines) | net -255 lines |

No changes to: `OrthoProcessingEditor.vue` (same interface), `sceneCoordinator.js` (same interface), `drillService.js` (kept for standalone use), `hollowService.js`, `geoUtils.js`.

---

## Verification

1. **Backend unit test:** `curl` workflow — create job → upload STL → POST ortho-auto-process → poll status → download ortho_final.stl
2. **Frontend E2E:** Open OrthoProcessingEditor → adjust params → click Generate → verify progress steps appear → verify final geometry replaces model
3. **Compare results:** Run the old FE-orchestrated pipeline and the new BE pipeline on the same model, compare output STL file sizes and visual results
4. **Check debug files:** Verify `jobs/{id}/output/` contains all intermediate STLs (hollow_aligned, hex_grid, drain_holes, sidewall_drains, ortho_final)
