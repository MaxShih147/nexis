# web_slicer_core API Documentation

A FastAPI-based SLA slicing service that wraps PrusaSlicer CLI.

## Overview

- **Host:** `127.0.0.1`
- **Port:** `5179`
- **CORS:** Enabled for local dev ports (`5173-5178`, `3000`), `https://dentalslice.onrender.com`, plus optional `CORS_ALLOWED_ORIGINS` env overrides

### API Versions
- **v1 API** (`/api/jobs`): Direct slicing workflow
- **v2 API** (`/api/v2/slices`): DS-Online compatible, job-based workflow

---

## Health & Status

### `GET /`
Health check endpoint.

**Response:**
```json
{
  "service": "web_slicer_core",
  "status": "running",
  "cli_available": true
}
```

---

## V1 API - Direct Slicing

### Create Job

#### `POST /api/jobs`
Create and start a new slicing job.

**Content-Type:** `multipart/form-data`

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `file` | File | Yes | STL file to slice |
| `config` | string | No | JSON string with SLAConfig parameters |

**Response:**
```json
{
  "job_id": "abc12345",
  "status": "pending"
}
```

**Errors:**
- `400`: Only .stl files supported, invalid JSON config
- `500`: File save failure

---

### Get Job Status

#### `GET /api/jobs/{job_id}`
Get the status of a slicing job.

**Response:**
```json
{
  "job_id": "abc12345",
  "status": "completed",
  "layer_count": 150,
  "estimated_print_time": 5420.0,
  "resin_volume_ml": 18.72,
  "error": null,
  "has_support_mesh": true,
  "has_hollow_mesh": false,
  "has_cut_mesh": false
}
```

**Status Values:** `pending` | `processing` | `completed` | `failed`

**Metadata Fields:**
- `estimated_print_time`: Estimated print time in seconds (nullable)
- `resin_volume_ml`: Estimated resin usage in milliliters (nullable)

**Errors:**
- `404`: Job not found

---

### Get Layer Image

#### `GET /api/jobs/{job_id}/layers/{idx}.png`
Get a specific layer as PNG image.

**Path Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `job_id` | string | Job identifier |
| `idx` | integer | Layer index (0-based) |

**Response:** PNG image (`image/png`)

**Errors:**
- `400`: Job not completed
- `404`: Job or layer not found

---

### Get Model STL

#### `GET /api/jobs/{job_id}/model.stl`
Get the original input model.

**Response:** Binary STL file (`application/octet-stream`)

**Errors:**
- `404`: Job or model not found

---

### Get Support Mesh

#### `GET /api/jobs/{job_id}/support.stl`
Get the generated support mesh.

**Response:** Binary STL file (`application/octet-stream`)

**Errors:**
- `400`: Job not completed
- `404`: Job not found or support mesh unavailable

---

### Get Hollow Mesh

#### `GET /api/jobs/{job_id}/hollow.stl`
Get the hollow interior mesh.

**Response:** Binary STL file (`application/octet-stream`)

**Errors:**
- `400`: Job not completed
- `404`: Job not found or hollow mesh unavailable

---

### Get Drain Holes Mesh

#### `GET /api/jobs/{job_id}/drain_holes.stl`
Get the generated drain holes mesh.

**Response:** Binary STL file (`application/octet-stream`)

**Errors:**
- `404`: Job not found or drain holes mesh unavailable

---

### Get Hex Grid Mesh

#### `GET /api/jobs/{job_id}/hex_grid.stl`
Get the generated hex grid mesh.

**Response:** Binary STL file (`application/octet-stream`)

**Errors:**
- `404`: Job not found or hex grid mesh unavailable

---

### Get Aligned Hollow Mesh

#### `GET /api/jobs/{job_id}/hollow_aligned.stl`
Get the aligned hollow mesh.

**Response:** Binary STL file (`application/octet-stream`)

**Errors:**
- `404`: Job not found or aligned hollow mesh unavailable

---

### Get Cut Meshes

#### `GET /api/jobs/{job_id}/cut.stl`
Get the combined cut mesh (both upper and lower parts).

**Response:** Binary STL file (`application/octet-stream`)

#### `GET /api/jobs/{job_id}/cut_upper.stl`
Get the upper part of the cut mesh.

**Response:** Binary STL file (`application/octet-stream`)

#### `GET /api/jobs/{job_id}/cut_lower.stl`
Get the lower part of the cut mesh.

**Response:** Binary STL file (`application/octet-stream`)

**Errors:**
- `400`: Job not completed
- `404`: Job not found or cut mesh unavailable

---

### Get Boolean Result

#### `GET /api/jobs/{job_id}/boolean.stl`
Get the result of a boolean operation.

**Response:** Binary STL file (`application/octet-stream`)

**Errors:**
- `404`: Job not found or boolean result unavailable

---

## V2 API - Job-Based Workflow

The V2 API provides a multi-step workflow:
1. Create job
2. Update config (optional)
3. Upload models
4. Execute operations (generate-supports, generate-hollow, cut, extend-bottom, generate-drain-holes, generate-hex-grid, boolean, execute)
5. Retrieve results

### Standard Response Format

All V2 endpoints return:
```json
{
  "success": true,
  "message": "Optional message",
  "data": { }
}
```

---

### Create Job

#### `POST /api/v2/slices`
Create a new slice job.

**Request Body:**
```json
{
  "config": { }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "abc12345"
  }
}
```

---

### Update Configuration

#### `PUT /api/v2/slices/{job_id}/config`
Update slice job configuration.

**Request Body:**
```json
{
  "config": {
    "Layer Height": 0.05,
    "Exposure Time": 10.0,
    "Bottom Exposure Time": 15.0
  },
  "isAppend": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Configuration updated"
}
```

**Errors:**
- `404`: Job not found or already executed

---

### Upload Model

#### `POST /api/v2/slices/{job_id}/upload`
Upload STL file to a slice job (recommended method).

**Content-Type:** `multipart/form-data`

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `file` | File | Yes | STL file to upload |

**Response:**
```json
{
  "success": true,
  "message": "File 'part.stl' uploaded",
  "data": {
    "modelId": "file_0",
    "filename": "part.stl"
  }
}
```

**Errors:**
- `400`: Invalid file type
- `404`: Job not found or already executed
- `500`: File read failure

---

### Add Models (Direct Vertex Data)

#### `POST /api/v2/slices/{job_id}/models`
Add models using direct vertex data.

**Request Body:**
```json
{
  "models": [
    {
      "vertices": [],
      "faces": []
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "modelIds": ["model_001", "model_002"]
  }
}
```

> **Note:** Direct vertex data is not fully supported. Use file upload instead.

---

### Execute Slicing

#### `POST /api/v2/slices/{job_id}/execute`
Execute the slice job (start full slicing with layer extraction).

**Response:**
```json
{
  "success": true,
  "message": "Slicing started",
  "data": {
    "currentConfig": { }
  }
}
```

**Errors:**
- `400`: No models added
- `404`: Job not found
- `501`: Direct vertex data not yet supported (use `/upload`)

---

### Generate Supports

#### `POST /api/v2/slices/{job_id}/generate-supports`
Generate support mesh only (preview without slicing).

**Response:**
```json
{
  "success": true,
  "message": "Support generation started",
  "data": { "currentConfig": { } }
}
```

**Output:** Available at `/api/jobs/{job_id}/support.stl`

**Errors:**
- `400`: No models added
- `404`: Job not found
- `501`: Direct vertex data not yet supported (use `/upload`)

---

### Generate Hollow

#### `POST /api/v2/slices/{job_id}/generate-hollow`
Generate hollow interior mesh (preview without slicing).

**Response:**
```json
{
  "success": true,
  "message": "Hollow generation started",
  "data": { "currentConfig": {} }
}
```

**Output:** Available at `/api/jobs/{job_id}/hollow.stl`

**Errors:**
- `400`: No models added
- `404`: Job not found
- `501`: Direct vertex data not yet supported (use `/upload`)

---

### Cut Model

#### `POST /api/v2/slices/{job_id}/cut`
Cut model at specified Z height.

**Request Body:**
```json
{
  "cut_height": 25.0,
  "keep_mode": "both"
}
```

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `cut_height` | float | - | Z height to cut at (mm) |
| `keep_mode` | string | `"both"` | `"both"`, `"upper"`, or `"lower"` |

**Response:**
```json
{
  "success": true,
  "data": {
    "cutHeight": 25.0,
    "keepMode": "both"
  }
}
```

**Outputs:**
- `keep_mode="both"`: `/api/jobs/{job_id}/cut_upper.stl` + `/api/jobs/{job_id}/cut_lower.stl`
- `keep_mode="upper"`: `/api/jobs/{job_id}/cut_upper.stl`
- `keep_mode="lower"`: `/api/jobs/{job_id}/cut_lower.stl`

**Errors:**
- `400`: No models added
- `404`: Job not found
- `501`: Direct vertex data not yet supported (use `/upload`)

---

### Extend Hollow Bottom

#### `POST /api/v2/slices/{job_id}/extend-bottom`
Extend bottom vertices of the generated hollow mesh downward.

This is a synchronous mesh-edit operation that:
- loads `/api/jobs/{job_id}/hollow.stl`
- moves vertices near the mesh minimum Z downward
- recomputes normals
- overwrites the hollow mesh STL

**Request Body:**
```json
{
  "bottom_z_threshold": 0.5,
  "extension_distance": 10.0
}
```

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `bottom_z_threshold` | float | `0.5` | Distance above min-Z used to select bottom vertices (mm) |
| `extension_distance` | float | `10.0` | Downward extension distance (mm) |

**Response:**
```json
{
  "success": true,
  "message": "Extended 1234 vertices by 10.0mm",
  "data": {
    "vertices_moved": 1234
  }
}
```

**Errors:**
- `400`: Hollow mesh exists but is empty
- `404`: Hollow mesh not found for job

---

### Generate Drain Holes

#### `POST /api/v2/slices/{job_id}/generate-drain-holes`
Generate drain hole cylinders at hex grid wall edges.

**Request Body:**
```json
{
  "hex_cell_radius": 5.0,
  "wall_thickness": 1.0,
  "grid_count": 10,
  "drain_radius": 1.5,
  "bottom_z": 0.0
}
```

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `hex_cell_radius` | float | `5.0` | Hex cell radius used to locate wall edges (mm) |
| `wall_thickness` | float | `1.0` | Wall thickness used to locate wall edges (mm) |
| `grid_count` | int | `10` | Number of grid cells per axis |
| `drain_radius` | float | `1.5` | Drain hole cylinder radius (mm) |
| `bottom_z` | float | `0.0` | Bottom Z plane for drain hole placement |

**Response:**
```json
{
  "success": true,
  "message": "Drain holes generated (1234 faces)",
  "data": {
    "resultPath": "/api/jobs/abc12345/drain_holes.stl",
    "faces": 1234
  }
}
```

**Output:** Available at `/api/jobs/{job_id}/drain_holes.stl`

**Errors:**
- `404`: Job not found

---

### Generate Hex Grid

#### `POST /api/v2/slices/{job_id}/generate-hex-grid`
Generate honeycomb hex grid infill mesh.

**Request Body:**
```json
{
  "hex_cell_radius": 5.0,
  "wall_thickness": 1.0,
  "grid_count": 10,
  "pyramid_height": 3.0,
  "fallback_height": 20.0,
  "bottom_z": 0.0
}
```

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `hex_cell_radius` | float | `5.0` | Hex cell radius (mm) |
| `wall_thickness` | float | `1.0` | Hex wall thickness (mm) |
| `grid_count` | int | `10` | Number of grid cells per axis |
| `pyramid_height` | float | `3.0` | Pyramid apex lift at each cell center (mm) |
| `fallback_height` | float | `20.0` | Fallback wall height when raycast misses (mm) |
| `bottom_z` | float | `0.0` | Bottom Z plane for grid generation |

**Response:**
```json
{
  "success": true,
  "message": "Hex grid generated (1234 faces)",
  "data": {
    "resultPath": "/api/jobs/abc12345/hex_grid.stl",
    "faces": 1234
  }
}
```

**Output:** Available at `/api/jobs/{job_id}/hex_grid.stl`

**Errors:**
- `404`: Job not found

---

### Boolean Operations (Experimental)

#### `POST /api/v2/boolean`
Perform boolean operation on two meshes.

**Content-Type:** `multipart/form-data`

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `mesh_a` | File | Yes | First STL mesh |
| `mesh_b` | File | Yes | Second STL mesh |
| `operation` | string | No | `"union"`, `"difference"`, or `"intersection"` (default: `"difference"`) |
| `parent_job_id` | string | No | Parent job ID for debug export |

**Operations:**
- `union`: Combine both meshes into one
- `difference`: Subtract mesh_b from mesh_a
- `intersection`: Keep only the overlapping region

**Response:**
```json
{
  "success": true,
  "message": "Boolean difference completed",
  "data": {
    "jobId": "abc12345",
    "operation": "difference",
    "resultPath": "/api/jobs/abc12345/boolean.stl"
  }
}
```

**Output:** Available at `/api/jobs/{job_id}/boolean.stl`

**Important:** Boolean result retrieval uses the `resultPath` returned by this endpoint, currently `/api/jobs/{job_id}/boolean.stl`. Do not use `GET /api/v2/slices/{job_id}` to wait for or download boolean output; that endpoint is for slice job status only.

**Errors:**
- `400`: Invalid operation or file type
- `500`: Boolean operation failed

---

### Parse PRZ File

#### `POST /api/v2/prz/parse`
Parse a PRZ V3.0 binary file and extract header metadata, preview images, and layer count.
No job is created; the file is processed synchronously and the result is returned immediately.

**Content-Type:** `multipart/form-data`

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `file` | File | Yes | PRZ V3.0 binary file (max 500 MB) |

**Response (200 OK):**
```json
{
  "header": {
    "version": "V3.0",
    "software": "",
    "software_version": "",
    "file_time": "2024-01-15 10:30:00",
    "printer_name": "MyPrinter",
    "printer_type": "DLP",
    "profile_name": "MyPrinter",
    "aa_level": 1,
    "grey_level": 1,
    "blur_level": 0,
    "total_layers": 150,
    "x_res": 1920,
    "y_res": 1080,
    "x_mirror": 0,
    "y_mirror": 0,
    "platform_x": 192.0,
    "platform_y": 108.0,
    "platform_z": 175.0,
    "layer_height": 0.05,
    "exposure_time": 2.5,
    "delay_mode": 1,
    "light_off_time": 1.0,
    "bottom_before_lift_time": 0.0,
    "bottom_after_lift_time": 0.0,
    "bottom_after_retract_time": 1.0,
    "before_lift_time": 0.0,
    "after_lift_time": 0.0,
    "after_retract_time": 1.0,
    "bottom_exposure_time": 35.0,
    "bottom_layers": 3,
    "bottom_lift_distance": 8.0,
    "bottom_lift_speed": 50.0,
    "normal_lift_distance": 7.0,
    "normal_lift_speed": 50.0,
    "bottom_retract_distance": 8.0,
    "bottom_retract_speed": 100.0,
    "normal_retract_distance": 7.0,
    "normal_retract_speed": 100.0,
    "bottom_lift2_distance": 0.0,
    "bottom_lift2_speed": 0.0,
    "normal_lift2_distance": 0.0,
    "normal_lift2_speed": 0.0,
    "bottom_drop2_distance": 0.0,
    "bottom_drop2_speed": 0.0,
    "normal_drop2_distance": 0.0,
    "normal_drop2_speed": 0.0,
    "bottom_light_pwm": 200,
    "normal_light_pwm": 180,
    "advance_mode": 0,
    "print_time": 1200,
    "volume": 15.5,
    "weight": 15.5,
    "price": 15.5,
    "layer_content_offset": 195477,
    "grayscale_level": 1,
    "transition_layers": 2
  },
  "preview_small_b64": "<base64-encoded PNG string, 116×116 px RGB>",
  "preview_large_b64": "<base64-encoded PNG string, 290×290 px RGB>",
  "layer_count": 150
}
```

**Errors:**
- `400`: Invalid or corrupted PRZ file — response body contains `detail` with error message
- `413`: File exceeds 500 MB size limit

---

#### `header` Object Field Reference

| Field | Type | Unit | Description |
|-------|------|------|-------------|
| `version` | string | — | File format version, always `"V3.0"` |
| `software` | string | — | Authoring software name (currently always empty) |
| `software_version` | string | — | Authoring software version (currently always empty) |
| `file_time` | string | — | File creation timestamp `"YYYY-MM-DD HH:MM:SS"` |
| `printer_name` | string | — | Printer model name |
| `printer_type` | string | — | Printer technology, e.g. `"DLP"` |
| `profile_name` | string | — | Print profile name (same as `printer_name` in current encoder) |
| `aa_level` | integer | — | Anti-aliasing level (0 = off) |
| `grey_level` | integer | — | Grey level setting |
| `blur_level` | integer | px | Image blur pixel radius |
| `total_layers` | integer | — | Total number of layers in the file |
| `x_res` | integer | px | Display X resolution |
| `y_res` | integer | px | Display Y resolution |
| `x_mirror` | integer | — | X mirror flag: `0` = mirrored, `1` = normal |
| `y_mirror` | integer | — | Y mirror flag (always `0`) |
| `platform_x` | float | mm | Build platform width |
| `platform_y` | float | mm | Build platform depth |
| `platform_z` | float | mm | Maximum build height |
| `layer_height` | float | mm | Layer thickness |
| `exposure_time` | float | s | Normal layer UV exposure time |
| `delay_mode` | integer | — | Delay mode flag (always `1`) |
| `light_off_time` | float | s | Light-off delay between layers |
| `bottom_before_lift_time` | float | s | Rest before lift for bottom layers (always `0.0`) |
| `bottom_after_lift_time` | float | s | Rest after lift for bottom layers (always `0.0`) |
| `bottom_after_retract_time` | float | s | Rest after retract for bottom layers |
| `before_lift_time` | float | s | Rest before lift for normal layers (always `0.0`) |
| `after_lift_time` | float | s | Rest after lift for normal layers (always `0.0`) |
| `after_retract_time` | float | s | Rest after retract for normal layers |
| `bottom_exposure_time` | float | s | Bottom layer UV exposure time |
| `bottom_layers` | integer | — | Number of bottom layers |
| `bottom_lift_distance` | float | mm | Lift distance for bottom layers |
| `bottom_lift_speed` | float | mm/min | Lift speed for bottom layers |
| `normal_lift_distance` | float | mm | Lift distance for normal layers |
| `normal_lift_speed` | float | mm/min | Lift speed for normal layers |
| `bottom_retract_distance` | float | mm | Retract distance for bottom layers (= lift distance) |
| `bottom_retract_speed` | float | mm/min | Retract speed for bottom layers |
| `normal_retract_distance` | float | mm | Retract distance for normal layers (= lift distance) |
| `normal_retract_speed` | float | mm/min | Retract speed for normal layers |
| `bottom_lift2_distance` | float | mm | Second-stage lift distance for bottom layers |
| `bottom_lift2_speed` | float | mm/min | Second-stage lift speed for bottom layers |
| `normal_lift2_distance` | float | mm | Second-stage lift distance for normal layers |
| `normal_lift2_speed` | float | mm/min | Second-stage lift speed for normal layers |
| `bottom_drop2_distance` | float | mm | Second-stage retract distance for bottom layers |
| `bottom_drop2_speed` | float | mm/min | Second-stage retract speed for bottom layers |
| `normal_drop2_distance` | float | mm | Second-stage retract distance for normal layers |
| `normal_drop2_speed` | float | mm/min | Second-stage retract speed for normal layers |
| `bottom_light_pwm` | integer | 0–255 | UV light PWM duty cycle for bottom layers |
| `normal_light_pwm` | integer | 0–255 | UV light PWM duty cycle for normal layers |
| `advance_mode` | integer | — | Advanced mode flag (always `0`) |
| `print_time` | integer | s | Estimated total print time |
| `volume` | float | ml | Estimated resin volume used |
| `weight` | float | ml | Estimated resin weight (same value as `volume` in current encoder) |
| `price` | float | ml | Estimated resin price (same value as `volume` in current encoder) |
| `layer_content_offset` | integer | bytes | Byte offset where layer data begins (always `195477`) |
| `grayscale_level` | integer | — | Grayscale level (always `1`) |
| `transition_layers` | integer | — | Number of transition layers between bottom and normal exposure |

---

### Get Job Status

#### `GET /api/v2/slices/{job_id}`
Get slice job status.

**Response (executed job):**
```json
{
  "success": true,
  "data": {
    "jobId": "abc12345",
    "status": "completed",
    "layerCount": 150,
    "estimatedPrintTime": 5420.0,
    "resinVolumeMl": 18.72,
    "error": null,
    "hasSupportMesh": true,
    "hasHollowMesh": false,
    "hasCutMesh": false
  }
}
```

**Metadata Fields:**
- `estimatedPrintTime`: Estimated print time in seconds (nullable)
- `resinVolumeMl`: Estimated resin usage in milliliters (nullable)

**Response (pending job):**
```json
{
  "success": true,
  "data": {
    "jobId": "abc12345",
    "status": "created",
    "config": {},
    "modelCount": 1
  }
}
```

**Errors:**
- `404`: Job not found

---

### Get Layer Data

#### `GET /api/v2/slices/{job_id}/uchars`
Get layer data reference (DS-Online compatibility).

**Response:**
```json
{
  "success": true,
  "data": {
    "uchars": {
      "layerCount": 150,
      "layerEndpoint": "/api/jobs/{job_id}/layers/{idx}.png"
    }
  }
}
```

**Errors:**
- `400`: Job not completed
- `404`: Job not found

---

### Get G-code Metadata

#### `GET /api/v2/slices/{job_id}/gcode`
Get slice output metadata via a DS-Online-compatible "gcode" endpoint.

> SLA slicing returns `.sl1` layer/image output, not traditional G-code.

**Response:**
```json
{
  "success": true,
  "message": "SLA slicing produces layer images, not G-code",
  "data": {
    "gcode": null,
    "layerCount": 150,
    "estimatedPrintTime": 5420.0,
    "resinVolumeMl": 18.72,
    "format": "sl1"
  }
}
```

**Errors:**
- `400`: Job not completed
- `404`: Job not found

---

## Data Models

### SLAConfig

Configuration for slicing operations.

```python
# Layer settings
layer_height: float = 0.05          # Layer height in mm

# Exposure settings
exposure_time: float = 10.0          # Normal layer exposure (seconds)
initial_exposure_time: float = 15.0  # Bottom layer exposure (seconds)

# Support settings
supports_enable: bool = False
support_head_front_diameter: float = 0.4
support_head_penetration: float = 0.2
support_pillar_diameter: float = 1.0
support_points_density_relative: int = 100
support_object_elevation: float = 5.0
support_critical_angle: float = 45.0

# Pad settings
pad_enable: bool = False

# Hollow settings
hollowing_enable: bool = False
hollowing_min_thickness: float = 3.0
hollowing_quality: float = 0.5
hollowing_closing_distance: float = 2.0

# Image quality settings
anti_aliasing: bool = True
anti_aliasing_level: int = 0
gray_level: int = 0
blur: int = 0

# Gamma correction
gamma_correction: float = 1.0

# Printer / material
printer_model: str = ""
sla_material_settings_id: str = ""

# Display resolution
display_pixels_x: int = 2560
display_pixels_y: int = 1440

# Display physical size (mm)
display_width: float = 120.0
display_height: float = 68.0
display_orientation: str = "landscape"

# Center position (mm), defaults to center of display
center_x: float | None = None
center_y: float | None = None
```

### CutConfig

Configuration for plane-cut operations.

```python
cut_height: float = 0.0   # Z height to cut at (mm)
keep_mode: str = "both"   # "both", "upper", or "lower"
```

### BooleanOperation

Available boolean operations.

```python
UNION = "union"             # Combine both meshes
DIFFERENCE = "difference"   # Subtract mesh_b from mesh_a
INTERSECTION = "intersection"  # Keep only overlapping region
```

### JobStatus

```python
PENDING = "pending"       # Job created, not yet started
PROCESSING = "processing" # Slicing in progress
COMPLETED = "completed"   # Slicing finished successfully
FAILED = "failed"         # Slicing failed with error
```

---

## Job Directory Structure

```
jobs/
└── {job_id}/
    ├── input/
    │   ├── model.stl              # Original uploaded model
    │   ├── mesh_a.stl             # First mesh (boolean ops)
    │   └── mesh_b.stl             # Second mesh (boolean ops)
    ├── output/
    │   ├── model.sl1              # SLA slice file (zip)
    │   ├── model_support.stl      # Generated support mesh
    │   ├── model_hollow.stl       # Hollow interior mesh
    │   ├── model_hollow_aligned.stl # Aligned hollow mesh
    │   ├── model_drain_holes.stl  # Generated drain holes mesh
    │   ├── model_hex_grid.stl     # Generated hex grid mesh
    │   ├── model_cut.stl          # Combined cut mesh
    │   ├── model_upper.stl        # Upper cut part
    │   ├── model_lower.stl        # Lower cut part
    │   └── model_boolean_{operation}.stl # Boolean operation result
    ├── layers/
    │   ├── 0.png                  # Layer 0 image
    │   ├── 1.png                  # Layer 1 image
    │   └── ...
    └── status.json                # Job status and metadata
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `400` | Bad Request - Invalid file, missing models, job not completed |
| `404` | Not Found - Job doesn't exist, mesh/layer unavailable |
| `413` | Payload Too Large - Uploaded file exceeds size limit (500 MB for PRZ parse) |
| `500` | Internal Server Error - File save/read failures |
| `501` | Not Implemented - Direct vertex data not supported |

---

## Examples

### Basic Slicing Workflow (V1)

```bash
# 1. Create slicing job
curl -X POST http://127.0.0.1:5179/api/jobs \
  -F "file=@model.stl" \
  -F 'config={"layer_height": 0.05, "supports_enable": true}'

# Response: {"job_id": "abc12345", "status": "pending"}

# 2. Poll for completion
curl http://127.0.0.1:5179/api/jobs/abc12345

# 3. Download layer images
curl http://127.0.0.1:5179/api/jobs/abc12345/layers/0.png -o layer0.png

# 4. Download support mesh
curl http://127.0.0.1:5179/api/jobs/abc12345/support.stl -o support.stl
```

### Multi-step Workflow (V2)

```bash
# 1. Create job
curl -X POST http://127.0.0.1:5179/api/v2/slices \
  -H "Content-Type: application/json" \
  -d '{}'

# Response: {"success": true, "data": {"jobId": "abc12345"}}

# 2. Upload model
curl -X POST http://127.0.0.1:5179/api/v2/slices/abc12345/upload \
  -F "file=@model.stl"

# 3. Configure
curl -X PUT http://127.0.0.1:5179/api/v2/slices/abc12345/config \
  -H "Content-Type: application/json" \
  -d '{"config": {"Layer Height": 0.05}, "isAppend": true}'

# 4. Generate supports preview
curl -X POST http://127.0.0.1:5179/api/v2/slices/abc12345/generate-supports

# 5. Execute full slicing
curl -X POST http://127.0.0.1:5179/api/v2/slices/abc12345/execute
```

### Cut Model at Z Height

```bash
# Cut at 25mm, keeping both parts
curl -X POST http://127.0.0.1:5179/api/v2/slices/abc12345/cut \
  -H "Content-Type: application/json" \
  -d '{"cut_height": 25.0, "keep_mode": "both"}'

# Download parts
curl http://127.0.0.1:5179/api/jobs/abc12345/cut_upper.stl -o upper.stl
curl http://127.0.0.1:5179/api/jobs/abc12345/cut_lower.stl -o lower.stl
```

### Boolean Operations (Experimental)

```bash
# Subtract mesh_b from mesh_a (difference)
curl -X POST http://127.0.0.1:5179/api/v2/boolean \
  -F "mesh_a=@solid.stl" \
  -F "mesh_b=@hole.stl" \
  -F "operation=difference"

# Response: {"success": true, "data": {"jobId": "xyz789", "resultPath": "/api/jobs/xyz789/boolean.stl"}}

# Download result
curl http://127.0.0.1:5179/api/jobs/xyz789/boolean.stl -o result.stl

# Union (combine meshes)
curl -X POST http://127.0.0.1:5179/api/v2/boolean \
  -F "mesh_a=@part1.stl" \
  -F "mesh_b=@part2.stl" \
  -F "operation=union"

# Intersection (keep only overlap)
curl -X POST http://127.0.0.1:5179/api/v2/boolean \
  -F "mesh_a=@outer.stl" \
  -F "mesh_b=@inner.stl" \
  -F "operation=intersection"
```

### Parse PRZ File (JavaScript/fetch)

```javascript
// Upload a .prz file selected via <input type="file"> and display results
async function parsePrzFile(file) {
  const formData = new FormData();
  formData.append("file", file, file.name);

  const response = await fetch("http://127.0.0.1:5179/api/v2/prz/parse", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Parse failed (${response.status}): ${err.detail ?? "unknown error"}`);
  }

  const data = await response.json();

  // Display small preview image
  const smallImg = document.getElementById("preview-small");
  smallImg.src = `data:image/png;base64,${data.preview_small_b64}`;

  // Display large preview image
  const largeImg = document.getElementById("preview-large");
  largeImg.src = `data:image/png;base64,${data.preview_large_b64}`;

  // Read common header fields
  const header = data.header;
  console.log("Printer:", header.printer_name);
  console.log("Resolution:", `${header.x_res}×${header.y_res}`);
  console.log("Layer height:", header.layer_height, "mm");
  console.log("Layer count:", data.layer_count);
  console.log("Exposure time:", header.exposure_time, "s");
  console.log("Bottom exposure:", header.bottom_exposure_time, "s");
  console.log("Bottom layers:", header.bottom_layers);
  console.log("Estimated print time:", header.print_time, "s");
  console.log("Resin volume:", header.volume, "ml");

  return data;
}

// Wire up to a file input
document.getElementById("prz-input").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) parsePrzFile(file).catch(console.error);
});
```

**Corresponding HTML:**
```html
<input type="file" id="prz-input" accept=".prz" />
<img id="preview-small" alt="Small preview" />
<img id="preview-large" alt="Large preview" />
```
