# slicing_core API 契約

## 基本資訊
| 最後確認日期 | 2026-06-03 |


## Headers 與身份驗證

| Header | 必填 | 適用範圍 | 備註 |
| --- | --- | --- | --- |
| `Content-Type: application/json` | 是 | JSON endpoints | Job/config/operation endpoints 使用。 |
| `Content-Type: multipart/form-data` | 是 | Upload endpoints | STL/PRZ upload endpoints 使用。 |

## 共用 Response 格式

### V1 JSON

V1 endpoints 回傳 endpoint-specific JSON。

```json
{
  "job_id": "a1b2c3d4",
  "status": "pending"
}
```

### V2 JSON

多數 V2 endpoints 回傳：

```json
{
  "success": true,
  "message": "Job created",
  "data": {}
}
```

### Binary

Binary endpoints 回傳 `FileResponse`，例如 `image/png`、`application/zip`、`application/octet-stream`、`model/stl` 或 PRZ binary。

## 現行錯誤格式

### Legacy / HTTPException JSON

V1 endpoints 與少數 V2 endpoints 仍使用 FastAPI `HTTPException`，回傳：

```json
{
  "detail": "error message"
}
```

### Structured APIError JSON

多數 V2 slicing/geometry endpoints 已改用 structured API error，回傳：

```json
{
  "success": false,
  "code": "INTERNAL_ERROR",
  "message": "error message",
  "data": {
    "retryable": true,
    "traceId": "12-char-hex"
  }
}
```

`GET /api/v2/slices/{job_id}` 在 job 失敗時會以 HTTP 200 回傳 `success: false` 與 structured error，讓 polling client 不需要把失敗 job 當成 transport error。

## 資料模型

### `SLAConfig`

| 欄位 | 型別 | 預設值 | 備註 |
| --- | --- | --- | --- |
| `layer_height` | number | `0.05` | Layer height，單位 mm。 |
| `exposure_time` | number | `10.0` | 一般曝光時間。 |
| `initial_exposure_time` | number | `15.0` | 底層曝光時間。 |
| `supports_enable` | boolean | `false` | 是否啟用 PrusaSlicer support generation。 |
| `support_head_front_diameter` | number | `0.4` | Support head diameter。 |
| `support_head_penetration` | number | `0.2` | Support head penetration。 |
| `support_pillar_diameter` | number | `1.0` | Support pillar diameter。 |
| `support_points_density_relative` | integer | `100` | Relative support density。 |
| `support_object_elevation` | number | `5.0` | 小於 `5.0` 會被 clamp 到 `5.0`。 |
| `support_critical_angle` | number | `45.0` | Critical overhang angle。 |
| `pad_enable` | boolean | `false` | Pad generation。 |
| `hollowing_enable` | boolean | `false` | Hollowing。 |
| `hollowing_min_thickness` | number | `3.0` | 最小壁厚。 |
| `hollowing_quality` | number | `0.5` | Hollowing quality。 |
| `hollowing_closing_distance` | number | `2.0` | Closing distance。 |
| `anti_aliasing` | boolean | `true` | 是否啟用 anti-aliasing。 |
| `anti_aliasing_level` | integer | `0` | AA level。 |
| `gray_level` | integer | `0` | Gray level。 |
| `blur` | integer | `0` | Image blur pixels（Prusa INI 預設 **0** = 關；產品啟用時多為 **1–7**，對應 UI 顯示 2–8）。引擎有效範圍 0–10。 |
| `gamma_correction` | number | `1.0` | Gamma correction。 |
| `printer_model` | string | `""` | Printer/material profile key。 |
| `sla_material_settings_id` | string | `""` | Resin/material profile key。 |
| `display_pixels_x` | integer | `2560` | LCD pixel width。 |
| `display_pixels_y` | integer | `1440` | LCD pixel height。 |
| `display_width` | number | `120.0` | 實體寬度，單位 mm。 |
| `display_height` | number | `68.0` | 實體高度，單位 mm。 |
| `display_orientation` | string | `"landscape"` | Display orientation。 |
| `center_x` | number or null | `null` | 預設為 `display_width / 2`。 |
| `center_y` | number or null | `null` | 預設為 `display_height / 2`。 |

### V2 Slice Config Intake

V2 slicing job 的模型上傳與 config 上傳是分離的：

- `POST /api/v2/slices`：建立 job，可同時送初始 `prz_config`、舊版 `config` 與頂層 `center`。
- `PUT /api/v2/slices/{job_id}/config`：execute 前更新 `config` / `prz_config`。
- `POST /api/v2/slices/{job_id}/upload`：只上傳 STL，multipart 欄位只有 `file`，不接收 slicing config。
- `POST /api/v2/slices/{job_id}/execute`：開始切片；此時後端會把 `prz_config` 落成 `jobs/{id}/prz_config.json`，並用它萃取切片參數與同步 PRZ print time。

新流程建議前端只送完整 Mechado config 到頂層 `prz_config`，格式為三段式 `Machine` / `Print` / `Advanced`。`center` 是 per-job 幾何位移，必須放在 request body 頂層，不能寫入 reusable Mechado profile。

```json
{
  "prz_config": {
    "Machine": {
      "machine_type": "sonic_4k_2022",
      "image_size": [3840, 2160],
      "bed_size": [0.0, 0.0, 134.0, 75.0]
    },
    "Print": {
      "Layer Height": 0.05,
      "Exposure Time": 2.5,
      "Bottom Exposure Time": 35.0,
      "Bottom Layer Count": 6,
      "Lifting Distance": 7.0,
      "Lifting Speed": 50.0,
      "Retract Distance": 2.0
    },
    "Advanced": {
      "Anti-aliasing": true,
      "Anti-aliasing Level": 2,
      "Grey Level": 0,
      "Image Blur": true,
      "Image Blur Pixel": 1,
      "Light PWM": 255,
      "Bottom Light PWM": 255
    },
    "Other": {}
  },
  "center": [10.0, -5.0]
}
```

後端會從 `prz_config` 萃取 `SLAConfig`：

| Mechado source | Internal field | 備註 |
| --- | --- | --- |
| `Print.Layer Height` | `layer_height` | 單位 mm。 |
| `Print.Exposure Time` | `exposure_time` | 一般曝光時間。 |
| `Print.Bottom Exposure Time` | `initial_exposure_time` | 底層曝光時間。 |
| `Print.Bottom Layer Count` | `bottom_layer_count` | 底層數。 |
| `Print.Retract Distance` | `retract_distance` | PRZ retract motion。 |
| `Print.Bottom Retract Distance` | `bottom_retract_distance` | PRZ bottom retract motion。 |
| `Print.Retract Second Distance` | `retract_second_distance` | PRZ second retract/drop distance。 |
| `Print.Bottom Retract Second Distance` | `bottom_retract_second_distance` | PRZ bottom second retract/drop distance。 |
| `Machine.machine_type` | `printer_model` | Printer profile key。 |
| `Machine.image_size[0]` | `display_pixels_x` | LCD pixel width。 |
| `Machine.image_size[1]` | `display_pixels_y` | LCD pixel height。 |
| `Machine.bed_size[2]` | `display_width` | 注意不是 `bed_size[0]`。 |
| `Machine.bed_size[3]` | `display_height` | 注意不是 `bed_size[1]`。 |
| `Advanced.Anti-aliasing` | `anti_aliasing` | 是否啟用 AA。 |
| `Advanced.Anti-aliasing Level` | `anti_aliasing_level` | 已是後端 Prusa 刻度 `0/1/2`，不得二次轉換成 UI 顯示值。 |
| `Advanced.Grey Level` | `gray_level` | 直接複製。 |
| `Advanced.Image Blur` | — | Image Blur 啟用旗標（bool）。與 `Advanced.Image Blur Pixel` 共同決定 `blur`。 |
| `Advanced.Image Blur Pixel` | `blur` | 後端刻度 1–7；`blur = imageBlur ? imageBlurPixel : 0`（`Image Blur=false` 時輸出 0）。 |
| top-level `center[0]` | `center_x` | `center[0] + display_width / 2`。 |
| top-level `center[1]` | `center_y` | `center[1] + display_height / 2`。 |

舊版 snake_case `config` 仍支援。若同時提供 `prz_config` 與 snake_case `config`，execute 時以 `prz_config` 萃取結果為 base，再由 snake_case `config` 逐欄覆蓋，last-write-wins。

### Legacy DS-Online Config Mapping

V2 支援 snake_case `SLAConfig` keys，也支援放在 `config.Print` 或 config root 的 DS-Online style keys。

| DS-Online key | Internal field |
| --- | --- |
| `Layer Height` | `layer_height` |
| `Exposure Time` | `exposure_time` |
| `Bottom Exposure Time` | `initial_exposure_time` |
| `Machine Type` | `printer_model` |
| `Resin` | `sla_material_settings_id` |
| `Anti-aliasing` | `anti_aliasing` |
| `Anti-aliasing Level` | `anti_aliasing_level` |
| `Grey Level` | `gray_level` |
| `Image Blur Pixel` | `blur` |
| `Image Size` | `display_pixels_x`, `display_pixels_y` |
| `Bed Size` | `display_width`, `display_height` |
| `center` | `center_x`, `center_y`，從 display center 偏移 |

### Job Status

`pending`, `processing`, `completed`, `failed`。

### V2 Job Status Response Notes

`GET /api/v2/slices/{job_id}` 對 pending job 回傳：

```json
{
  "success": true,
  "data": {
    "jobId": "a1b2c3d4",
    "status": "created",
    "config": {},
    "modelCount": 1
  }
}
```

已執行或已完成的 job 回傳 `layerCount`、`estimatedPrintTime`、`resinVolumeMl`、`hasSupportMesh`、`hasHollowMesh`、`hasCutMesh`、`hasOrthoResult`，若有 orthodontic pipeline 進度則包含 `orthoProgress`。

### PRZ Session

`POST /api/v2/prz/parse` 成功後會建立 server-side session，`session_id` 為 UUID v4。後端每 5 分鐘清理一次 idle 超過 30 分鐘的 PRZ session；成功讀取任一 layer 會重設該 session 的 last access time。

## Endpoint 清單

| Method + Endpoint | 功能簡介 | Params | Request Body | Response Body | Errors | Headers |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /` | 檢查服務與 CLI 是否可用。 | None | None | `{ service, status, cli_available }` | `500 INTERNAL_ERROR` | None |
| `GET /api/health` | 與 `/` 相同。 | None | None | `{ service, status, cli_available }` | `500 INTERNAL_ERROR` | None |
| `GET /test/boolean` | Boolean testing 用的 dev HTML page。 | None | None | HTML | `500 INTERNAL_ERROR` | Response `text/html` |
| `POST /api/jobs` | 上傳單一 STL 並立即開始 V1 slicing job。 | multipart fields：`file` 必填 `.stl`，`config` optional JSON string | `multipart/form-data` | `{ job_id, status }` | `400 INVALID_FILE_TYPE`, `400 INVALID_CONFIG_JSON`, `400 INVALID_CONFIG`, `500 SAVE_FILE_FAILED` | `Content-Type: multipart/form-data` |
| `GET /api/jobs/{job_id}` | 讀取 V1 job 狀態與 output summary。 | path `job_id` 必填 | None | `{ job_id, status, layer_count, estimated_print_time, resin_volume_ml, error, has_support_mesh, has_hollow_mesh, has_cut_mesh }` | `404 JOB_NOT_FOUND` | None |
| `GET /api/jobs/{job_id}/layers/{idx}.png` | 下載指定 layer PNG。 | path `job_id`, `idx` integer | None | PNG binary | `400 JOB_NOT_COMPLETED`, `404 JOB_NOT_FOUND`, `404 LAYER_NOT_FOUND` | Response `image/png` |
| `GET /api/jobs/{job_id}/layers.zip` | 下載 layer archive。現行實作回傳 `.sl1` ZIP content。 | path `job_id` | None | ZIP binary | `400 JOB_NOT_COMPLETED`, `404 JOB_NOT_FOUND`, `404 LAYERS_NOT_AVAILABLE` 或 `SL1_NOT_FOUND` | Response `application/zip` |
| `GET /api/jobs/{job_id}/preview.zip` | 從 `.sl1` 下載或 lazy-generate preview ZIP。 | path `job_id` | None | ZIP binary | `400 JOB_NOT_COMPLETED`, `404 JOB_NOT_FOUND`, `404 SL1_NOT_FOUND` | Response `application/zip` |
| `POST /api/jobs/{job_id}/download.prz` | 使用完成的 `.sl1` 與 printer config 產生並下載 PRZ。 | path `job_id` | JSON Mechado/PRZ config object | PRZ binary | `400 JOB_NOT_COMPLETED`, `404 JOB_NOT_FOUND`, `404 SL1_NOT_FOUND`, `500 PRZ_ENCODE_FAILED` | Response binary attachment |
| `GET /api/jobs/{job_id}/model.stl` | 下載原始 model STL。 | path `job_id` | None | STL binary | `404 JOB_NOT_FOUND`, `404 MODEL_NOT_FOUND` | Response `model/stl` 或 octet stream |
| `GET /api/jobs/{job_id}/support.stl` | 下載 generated support mesh。 | path `job_id` | None | STL binary | `400 JOB_NOT_COMPLETED`, `404 JOB_NOT_FOUND`, `404 SUPPORT_MESH_NOT_AVAILABLE` | Response STL binary |
| `GET /api/jobs/{job_id}/hollow.stl` | 下載 generated hollow mesh。 | path `job_id` | None | STL binary | `400 JOB_NOT_COMPLETED`, `404 JOB_NOT_FOUND`, `404 HOLLOW_MESH_NOT_AVAILABLE` | Response STL binary |
| `GET /api/jobs/{job_id}/drain_holes.stl` | 下載 generated drain holes mesh。 | path `job_id` | None | STL binary | `404 JOB_NOT_FOUND`, `404 DRAIN_HOLES_MESH_NOT_AVAILABLE` | Response STL binary |
| `GET /api/jobs/{job_id}/hex_grid.stl` | 下載 generated hex grid mesh。 | path `job_id` | None | STL binary | `404 JOB_NOT_FOUND`, `404 HEX_GRID_MESH_NOT_AVAILABLE` | Response STL binary |
| `GET /api/jobs/{job_id}/hollow_aligned.stl` | 下載 aligned hollow mesh。 | path `job_id` | None | STL binary | `404 JOB_NOT_FOUND`, `404 ALIGNED_HOLLOW_MESH_NOT_AVAILABLE` | Response STL binary |
| `GET /api/jobs/{job_id}/cut.stl` | 下載 combined cut mesh。 | path `job_id` | None | STL binary | `400 JOB_NOT_COMPLETED`, `404 JOB_NOT_FOUND`, `404 CUT_MESH_NOT_AVAILABLE` | Response STL binary |
| `GET /api/jobs/{job_id}/cut_upper.stl` | 下載 upper cut mesh。 | path `job_id` | None | STL binary | `400 JOB_NOT_COMPLETED`, `404 JOB_NOT_FOUND`, `404 UPPER_CUT_MESH_NOT_AVAILABLE` | Response STL binary |
| `GET /api/jobs/{job_id}/cut_lower.stl` | 下載 lower cut mesh。 | path `job_id` | None | STL binary | `400 JOB_NOT_COMPLETED`, `404 JOB_NOT_FOUND`, `404 LOWER_CUT_MESH_NOT_AVAILABLE` | Response STL binary |
| `GET /api/jobs/{job_id}/boolean.stl` | 下載 boolean operation result。 | path `job_id` | None | STL binary | `404 JOB_NOT_FOUND`, `404 BOOLEAN_RESULT_NOT_AVAILABLE` | Response STL binary |
| `GET /api/jobs/{job_id}/ortho_result.stl` | 下載 orthodontic processing output。 | path `job_id` | None | STL binary | `404 JOB_NOT_FOUND`, `200 JOB_STILL_PROCESSING`, `409 JOB_FAILED`, `404 FILE_NOT_FOUND` | Response STL binary |
| `POST /api/v2/slices` | 建立空的 V2 slicing job，可帶初始 config。新流程使用 `prz_config`；舊流程可用 snake_case `config`。 | None | `{ config?: object, prz_config?: object, center?: [number, number] }` | V2 `{ data: { jobId } }` | `400 VALIDATION_ERROR`, `400 MISSING_BODY`, `500 INTERNAL_ERROR` | JSON |
| `PUT /api/v2/slices/{job_id}/config` | 在執行前 replace 或 append V2 job config。`prz_config` 若提供會完整取代 pending job 的 Mechado config。 | path `job_id` | `{ config: object, isAppend?: boolean, prz_config?: object }` | V2 `{ success: true, message: "Config updated" }` | `404 JOB_NOT_FOUND`, `409 JOB_ALREADY_EXECUTED`, `400 VALIDATION_ERROR`, `400 MISSING_BODY` | JSON |
| `POST /api/v2/slices/{job_id}/models` | 加入 model metadata 到 V2 job；實際執行目前需 `stl_data` 或 upload。 | path `job_id` | `{ models: [{ id?, name?, vertices?, faces?, stl_data? }] }` | V2 `{ data: { modelIds } }` | `404 JOB_NOT_FOUND`, `409 JOB_ALREADY_EXECUTED`, `400 MISSING_BODY`, `400 VALIDATION_ERROR` | JSON |
| `POST /api/v2/slices/{job_id}/upload` | 上傳單一 STL 到 V2 job；不接收 slicing config。 | path `job_id`; multipart `file` 必填 `.stl` | `multipart/form-data` | V2 `{ data: { modelId, filename } }` | `404 JOB_NOT_FOUND`, `409 JOB_ALREADY_EXECUTED`, `400 MISSING_BODY`, `400 VALIDATION_ERROR`, `422 INVALID_MODEL`, `500 INTERNAL_ERROR` | Multipart |
| `POST /api/v2/slices/{job_id}/use-model-from/{source_job_id}` | 使用另一個 job 的 output/input file 作為本 job model。 | path `job_id`, `source_job_id`; query `source_file` default `boolean.stl` | None | V2 `{ data: { modelId, sourceJobId } }` | `404 JOB_NOT_FOUND`, `404 MODEL_NOT_FOUND`, `500 INTERNAL_ERROR` | None |
| `POST /api/v2/slices/{job_id}/execute` | 執行完整 SLA slicing。若 job 有 `prz_config`，後端會持久化為 `prz_config.json`，並以 Mechado 萃取為 base、snake_case `config` 欄位級覆蓋後產生 `SLAConfig`。 | path `job_id` | None | V2 `{ data: { currentConfig } }`；完成狀態由 `GET /api/v2/slices/{job_id}` 查詢 | `404 JOB_NOT_FOUND`, `409 JOB_ALREADY_EXECUTED`, `404 MODEL_NOT_FOUND`, `422 INVALID_MODEL`, `500 INTERNAL_ERROR` | None |
| `POST /api/v2/slices/{job_id}/generate-supports` | 為目前 model 產生 supports。 | path `job_id` | None | V2 `{ data: { currentConfig } }` 或已存在時 `{ data: { hasSupportMesh } }` | `404 JOB_NOT_FOUND`, `404 MODEL_NOT_FOUND`, `422 INVALID_MODEL`, `500 INTERNAL_ERROR` | None |
| `POST /api/v2/slices/{job_id}/generate-hollow` | 為目前 model 產生 hollow mesh。 | path `job_id` | None | V2 `{ data: { currentConfig } }` 或已存在時 `{ data: { hasHollowMesh } }` | `404 JOB_NOT_FOUND`, `404 MODEL_NOT_FOUND`, `422 INVALID_MODEL`, `500 INTERNAL_ERROR` | None |
| `POST /api/v2/slices/{job_id}/cut` | 依 Z height 切割 mesh。 | path `job_id` | `{ cut_height: number, keep_mode?: "both"|"upper"|"lower" }` | V2 `{ data: { cutHeight, keepMode } }` 或已存在時 `{ data: { hasCutMesh } }` | `404 JOB_NOT_FOUND`, `404 MODEL_NOT_FOUND`, `422 INVALID_MODEL`, `400 VALIDATION_ERROR`, `500 INTERNAL_ERROR` | JSON |
| `POST /api/v2/slices/{job_id}/extend-bottom` | 將 hollow mesh 底部附近 vertices 向下延伸，直接覆寫 hollow STL。 | path `job_id` | `{ bottom_z_threshold?: number, extension_distance?: number }` | V2 `{ data: { vertices_moved } }` | `404 JOB_NOT_FOUND`, `404 MODEL_NOT_FOUND`, `422 INVALID_MODEL`, `400 VALIDATION_ERROR`, `500 INTERNAL_ERROR` | JSON |
| `POST /api/v2/slices/{job_id}/generate-drain-holes` | 依 hex grid wall edge 產生 drain hole cylinders。 | path `job_id` | `{ hex_cell_radius?: number, wall_thickness?: number, grid_count?: integer, drain_radius?: number, bottom_z?: number }` | V2 `{ data: { resultPath, faces } }` | `404 JOB_NOT_FOUND`, `400 VALIDATION_ERROR`, `422 NO_DRAIN_HOLES`, `500 INTERNAL_ERROR` | JSON |
| `POST /api/v2/slices/{job_id}/generate-hex-grid` | 依 hollow mesh raycast 產生 honeycomb infill mesh，並輸出 aligned hollow mesh。 | path `job_id` | `{ hex_cell_radius?: number, wall_thickness?: number, grid_count?: integer, pyramid_height?: number, fallback_height?: number, bottom_z?: number }` | V2 `{ data: { resultPath, faces } }` | `404 JOB_NOT_FOUND`, `404 MODEL_NOT_FOUND`, `422 INVALID_MODEL`, `400 VALIDATION_ERROR`, `422 NO_HEX_GRID_CELLS`, `500 INTERNAL_ERROR` | JSON |
| `GET /api/v2/slices/{job_id}` | 讀取 V2 job 狀態與 output summary。 | path `job_id` | None | V2 job data；pending job 含 `config`、`modelCount`，已執行 job 含 output flags、metrics、`orthoProgress` | `404 JOB_NOT_FOUND`；job failed 時 HTTP 200 + `success: false` | None |
| `GET /api/v2/slices/{job_id}/preview.zip` | 下載 V2 preview ZIP；優先使用 PrusaSlicer 產生的 `model_preview.zip`，否則 lazy generate。 | path `job_id` | None | ZIP binary | `404 JOB_NOT_FOUND`, `200 JOB_STILL_PROCESSING`, `409 JOB_FAILED`, `404 FILE_NOT_FOUND`, `500 INTERNAL_ERROR` | Response `application/zip` |
| `GET /api/v2/slices/{job_id}/layers.zip` | 下載 V2 layers ZIP；現行直接回傳 `.sl1` ZIP content。 | path `job_id` | None | ZIP binary | `404 JOB_NOT_FOUND`, `200 JOB_STILL_PROCESSING`, `409 JOB_FAILED`, `404 FILE_NOT_FOUND` | Response `application/zip` |
| `POST /api/v2/slices/{job_id}/download.prz` | 為完成的 V2 job 產生並下載 PRZ。Body 可省略 config；空 body 時從該 job 的 `prz_config.json` 降級讀取。可選 `preview_small` / `preview_large`。 | path `job_id` | Optional JSON Mechado/PRZ config object；或 `{ preview_small?, preview_large?, ...config }` | PRZ binary | `404 JOB_NOT_FOUND`, `200 JOB_STILL_PROCESSING`, `409 JOB_FAILED`, `404 FILE_NOT_FOUND`, `400 VALIDATION_ERROR`, `422 VALIDATION_ERROR` | Response binary attachment |
| `GET /api/v2/slices/{job_id}/uchars` | 回傳 SLA layer byte/uchar metadata。 | path `job_id` | None | V2 `{ data: { uchars: { layerCount, layerEndpoint } } }` | `404 JOB_NOT_FOUND`, `200 JOB_STILL_PROCESSING`, `409 JOB_FAILED` | None |
| `GET /api/v2/slices/{job_id}/gcode` | Compatibility endpoint。SLA slicing 回傳 metadata，不產生 G-code。 | path `job_id` | None | V2 `{ data: { gcode: null, layerCount, estimatedPrintTime, resinVolumeMl, format: "sl1" } }` | `404 JOB_NOT_FOUND`, `200 JOB_STILL_PROCESSING`, `409 JOB_FAILED` | None |
| `POST /api/v2/slices/{job_id}/ortho-process` | 執行 orthodontic processing pipeline。 | path `job_id` | `{ hollowing_min_thickness?, hollowing_quality?, hollowing_closing_distance?, bottom_z_threshold?, extension_distance?, hex_cell_radius?, hex_wall_thickness?, hex_grid_count?, hex_pyramid_height?, drain_hole_radius? }` | V2 `{ data: { jobId } }`，進度由 `GET /api/v2/slices/{job_id}` 的 `orthoProgress` 查詢 | `404 JOB_NOT_FOUND`, `409 JOB_ALREADY_EXECUTED`, `404 MODEL_NOT_FOUND`, `422 INVALID_MODEL`, `500 INTERNAL_ERROR` | JSON |
| `POST /api/v2/boolean` | 對兩個上傳 STL 執行 boolean operation。 | multipart fields `mesh_a`, `mesh_b`, `operation`, optional `parent_job_id` | `multipart/form-data`; `operation` 為 `union`, `difference`, `intersection` | V2 `{ data: { jobId, operation, resultPath } }` | `400 MISSING_BODY`, `400 VALIDATION_ERROR`, `422 INVALID_MODEL`, `422 BOOLEAN_FAILED`, `500 INTERNAL_ERROR` | Multipart |
| `POST /api/v2/prz/parse` | 解析 PRZ V3.0 binary，建立 server-side PRZ session，回傳 header 與 preview images。 | multipart `file` 必填 PRZ binary，上限 500 MB | `multipart/form-data` | `{ header, preview_small_b64, preview_large_b64, layer_count, session_id }` | `413 FILE_TOO_LARGE`, `400 PRZ_PARSE_FAILED`，目前為 FastAPI `detail` 格式 | Multipart |
| `GET /api/v2/prz/{session_id}/layer/{index}` | 從 PRZ session lazy decode 指定 layer，回傳灰階 PNG。 | path `session_id`, `index` 0-based integer | None | PNG binary | `404 PRZ_SESSION_NOT_FOUND`, `422 PRZ_LAYER_INDEX_OUT_OF_RANGE`，目前為 FastAPI `detail` 格式 | Response `image/png` |
| `DELETE /api/v2/prz/{session_id}` | 主動釋放 PRZ session 記憶體；session idle 超過 30 分鐘也會自動清理。 | path `session_id` | None | HTTP 204 empty body | `404 PRZ_SESSION_NOT_FOUND`，目前為 FastAPI `detail` 格式 | None |

## Runtime 尚未實作項目

`POST /api/v2/slicing-presets` 出現在上游文件範例中，但未註冊於 `agent/main.py` 或 `agent/api_v2.py`。Preset persistence 應屬於 `account_management`，除非未來 OpenSpec change 明確指定由 `slicing_core` 負責。

## Error Code 登錄表

### Structured APIError codes

| code | HTTP status | retryable | 意義 |
| --- | --- | --- | --- |
| `INTERNAL_ERROR` | 500 | true | 未處理 exception 或內部 I/O/processing 錯誤。 |
| `VALIDATION_ERROR` | 400 | false | Request 參數格式、enum、content-type 或值域錯誤。 |
| `MISSING_BODY` | 400 | false | 必填欄位、檔案或上傳內容缺失。 |
| `JOB_NOT_FOUND` | 404 | false | 找不到 job id。 |
| `JOB_ALREADY_EXECUTED` | 409 | false | Job 已執行，不再接受 pending-only mutation。 |
| `JOB_STILL_PROCESSING` | 200 | true | Job 尚未完成但要求 output。 |
| `JOB_FAILED` | 409 | false | Job 已失敗，無法取得成功 output。 |
| `MODEL_NOT_FOUND` | 404 | false | Job 沒有 model，或 source/output mesh 不存在。 |
| `INVALID_MODEL` | 422 | false | STL 內容損壞、格式無效、mesh 空白，或幾何載入失敗。 |
| `FILE_NOT_FOUND` | 404 | false | Job 已完成但要求的 output file 不存在。 |
| `BOOLEAN_FAILED` | 422 | false | Boolean geometry operation 失敗。 |
| `NO_DRAIN_HOLES` | 422 | false | 目前幾何找不到可放置 drain hole 的 wall edge。 |
| `NO_HEX_GRID_CELLS` | 422 | false | Hex grid 演算法沒有產生任何 cell。 |
| `HOLLOW_GENERATION_FAILED` | 422 | false | PrusaSlicer hollow interior mesh 產生失敗。 |

### Legacy / detail-only mappings（待遷移至 Structured APIError codes）

| 文件化名稱 | HTTP status | 適用範圍 | 意義 |
| --- | --- | --- | --- |
| `INVALID_FILE_TYPE` | 400 | V1 upload / PRZ parse detail | 上傳檔案副檔名不支援。 |
| `INVALID_CONFIG_JSON` | 400 | V1 `POST /api/jobs` detail | `config` 欄位不是合法 JSON。 |
| `INVALID_CONFIG` | 400 | V1 `POST /api/jobs` detail | `config` 驗證失敗。 |
| `SAVE_FILE_FAILED` | 500 | V1 `POST /api/jobs` detail | 儲存上傳檔案失敗。 |
| `JOB_NOT_COMPLETED` | 400 | V1 output endpoints detail | Job 尚未完成但要求 output。 |
| `LAYER_NOT_FOUND` | 404 | V1 layer image detail | 找不到指定 layer file。 |
| `SL1_NOT_FOUND` | 404 | V1 PRZ/layers/preview detail | 找不到 `.sl1` archive。 |
| `PRZ_PARSE_FAILED` | 400 | `POST /api/v2/prz/parse` detail | PRZ parse 失敗。 |
| `FILE_TOO_LARGE` | 413 | `POST /api/v2/prz/parse` detail | PRZ upload 超過 500 MB。 |
| `PRZ_SESSION_NOT_FOUND` | 404 | PRZ session detail | 找不到 PRZ session，或 session 已被 TTL 清理。 |
| `PRZ_LAYER_INDEX_OUT_OF_RANGE` | 422 | PRZ layer detail | Layer index 小於 0 或大於等於 `layer_count`。 |

## 已知缺口

- V1 endpoints 與 PRZ session endpoints 仍有 FastAPI `detail` 格式，尚未全部收斂到 structured APIError。
- 尚未 enforce auth。
- `GET /api/jobs/{job_id}/layers.zip` 在 `agent/main.py` 中註冊了兩次。
- 部分 endpoint response bodies 是 operation-specific dynamic objects，未來應以明確 Pydantic models 收斂。
