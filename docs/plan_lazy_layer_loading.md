# Plan: Fix Slow PNG Layer Loading After Slicing

## Status: Resolved (via c580a79)

The main bottleneck (`transformBackendLayerPng`) was removed by Chloe in commit `c580a79`.
The fix removes PNG decode, horizontal flip, and grayscale re-encode on every layer,
replacing it with a CSS `transform: scaleX(-1)` on the preview image.

Lazy on-demand layer loading was considered but **deferred** — with the transform removed,
bulk fetching raw PNGs is fast enough, and lazy loading could introduce slider stutter.

---

## What Was Done

- `transformBackendLayerPng()` removed from `slicingService.js`
- `fast-png` encode/decode removed
- `fetchLayerBatch()` now stores raw backend blobs directly
- CSS `transform: scaleX(-1)` added to PreviewPage image for horizontal flip

## Future Improvements (Not Yet Implemented)

### 1. Backend Cache-Control header for layer PNGs
- Add `Cache-Control: public, max-age=86400, immutable` to the layer PNG endpoint
  (`GET /api/jobs/{job_id}/layers/{idx}.png` in `web_slicer_core/agent/main.py`)
- Layer PNGs never change after slicing, so browser/CDN caching is safe
- Prepares for future CDN migration (display PNGs served from CDN instead of backend)

### 2. Backend ZIP endpoint
- `POST /api/v2/slices/{jobId}/download/zip` — frontend sends gcode + preview,
  backend packages all layer PNGs into a single ZIP
- Eliminates 600+ individual HTTP requests for ZIP export

### 3. Backend RLE + PRZ endpoint
- `POST /api/v2/slices/{jobId}/download/prz` — frontend sends config + preview,
  backend does PNG → RLE compression → PRZ generation
- Requires running Mechado natively or via Node.js WASM on the backend
- Eliminates heavy client-side RLE + WASM processing

### 4. CDN for layer PNGs
- After slicing, upload processed PNGs to CDN (e.g. S3 + CloudFront)
- Frontend fetches display PNGs from CDN instead of backend
- Backend still handles export (ZIP/PRZ) since it has PNGs locally
