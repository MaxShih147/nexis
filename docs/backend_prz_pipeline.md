# Backend PRZ Pipeline Architecture

本文件描述後端切片 + PRZ 產生的完整流程與檔案結構。

## 1. 整體流程總覽

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant PS as PrusaSlicer

    U->>FE: 按下 Slice
    FE->>BE: POST /slices (建立 job)
    FE->>BE: POST /slices/{id}/upload (上傳 STL)
    FE->>BE: PUT /slices/{id}/config (切片設定)
    FE->>BE: POST /slices/{id}/execute (開始切片)

    BE->>PS: prusa-slicer-cli --export-sla
    PS-->>BE: model.sl1 (ZIP of PNGs)

    BE->>BE: extract_layers(sl1 → layers/*.png + metadata)
    BE->>BE: write_job_status(COMPLETED)

    loop polling 500ms
        FE->>BE: GET /slices/{id}
        BE-->>FE: status: processing / completed
    end

    FE->>BE: GET /slices/{id}/layers.zip
    BE-->>FE: model.sl1 直接回傳 (零處理時間)
    FE->>FE: JSZip 解壓 → PNG blobs → 顯示 layer viewer

    U->>FE: 按下 Download
    FE->>BE: POST /slices/{id}/download.prz (附 config JSON)
    BE->>BE: 讀 sl1 PNGs → grayscale → RLE encode → 組裝 PRZ
    BE-->>FE: StreamingResponse (.prz binary)
    FE->>U: 觸發瀏覽器下載 .prz
```

## 2. 切片階段詳細流程

```mermaid
flowchart TD
    A[POST /execute] --> B[run_slicing 背景任務]
    B --> C[PrusaSlicer CLI<br/>--export-sla]
    C --> D{model.sl1 產生成功?}
    D -->|Yes| E[extract_layers]
    D -->|No| F[write_job_status FAILED]

    E --> E1[解壓 PNG 到 layers/0.png ~ N.png]
    E --> E2[解析 config.ini<br/>printTime, usedMaterial]
    E1 --> G[write_job_status COMPLETED]
    E2 --> G

    F --> Z[結束]
    G --> Z
```

## 3. 圖層預覽下載 — Fallback Chain

```mermaid
flowchart LR
    A[前端需要 layer 圖片] --> B{layers.zip}
    B -->|200 OK| C[JSZip 解壓 PNG blobs<br/>直接回傳 model.sl1<br/>零處理時間]
    B -->|失敗| D{preview.zip}
    D -->|200 OK| E[JSZip 解壓 WebP blobs<br/>縮小版預覽圖]
    D -->|失敗| F[個別下載 layers/0.png ~ N.png<br/>最慢但最可靠]
```

## 4. PRZ 下載流程

```mermaid
flowchart TD
    A[使用者按 Download] --> B{exportFileType == prz?}
    B -->|No| Z1[ZIP 下載流程]
    B -->|Yes| C{backendJobId 存在?}

    C -->|Yes| D[POST /download.prz<br/>body = Mechado config JSON]
    D --> E{HTTP 200?}
    E -->|Yes| F[收到 .prz blob → 觸發下載]
    E -->|No| G[Fallback: 前端 WASM 產生 PRZ]

    C -->|No| G
    G --> G1[pngBlobs → decode → RLE mask]
    G1 --> G2[Mechado WASM ImportPixels_JS]
    G2 --> G3[GetPRZ_JS → .prz bytes]
    G3 --> F
```

## 5. PRZ 二進位格式結構

```mermaid
block-beta
    columns 1
    block:header["Header (195,477 bytes)"]
        h1["Version 'V3.0' (4B)"]
        h2["Tag (8B)"]
        h3["Software / Version / Time (80B)"]
        h4["Printer Name / Type / Profile (96B)"]
        h5["AA / Grey / Blur Level (6B)"]
        h6["Preview 116x116 RGB565 (26,912B)"]
        h7["Preview 290x290 RGB565 (168,200B)"]
        h8["Layer Count / Resolution / Mirror (14B)"]
        h9["Platform Size / Layer Height (16B)"]
        h10["Exposure / Lift / Retract params"]
        h11["Print Time / Volume / Weight / Price"]
        h12["Layer Content Offset = 195477"]
    end
    block:layers["Per-Layer x N"]
        l1["Layer Definition (64 bytes)<br/>PauseFlag(2B) + PauseZ(4B) + LayerZ(4B)<br/>Exposure(4B) + OffTime(4B)<br/>BeforeLift/AfterLift/AfterRetract(12B)<br/>8x Lift/Retract params(32B)<br/>LightPWM(2B)"]
        l2["CRLF (2B)"]
        l3["RLE Byte Count (4B)"]
        l4["RLE Encoded Pixels<br/>0x55 header + runs + checksum"]
        l5["CRLF (2B)"]
    end
    block:footer["Footer (11 bytes)"]
        f1["\\x00\\x00\\x00\\x07\\x00\\x00\\x00DLP\\x00"]
    end
```

## 6. RLE 編碼格式

```mermaid
flowchart LR
    A[灰階圖 row-by-row] --> B[找連續相同像素]
    B --> C{像素值}
    C -->|0| D["color_type = 0x00 (black)"]
    C -->|255| E["color_type = 0xC0 (white)"]
    C -->|其他| F["color_type = 0x40 (gray)<br/>+ 1 byte gray value"]

    D --> G[編碼 run length]
    E --> G
    F --> G

    G --> H{"run < 16"}
    H -->|Yes| I["0 extra bytes"]
    H -->|No| J{"run < 4096"}
    J -->|Yes| K["1 extra byte"]
    J -->|No| L["2-3 extra bytes"]
```

## 7. Job 檔案結構

```mermaid
flowchart TD
    subgraph "jobs/{id}/"
        subgraph input/
            A1[model.stl]
        end
        subgraph output/
            B1[model.sl1<br/>PrusaSlicer 產生<br/>ZIP of full-res PNGs]
            B2["preview.zip (可選)<br/>縮小版 WebP"]
        end
        subgraph layers/
            C1["0.png ~ N.png<br/>解壓出的全解析度 PNG"]
        end
        D1[status.json<br/>status, layer_count<br/>print_time, resin_ml]
        D2[config.json<br/>切片設定]
        D3[config.ini<br/>PrusaSlicer INI]
        D4[stderr.log]
    end
```

## 8. Backend API 端點

| Method | Path | 說明 |
|--------|------|------|
| POST | `/api/v2/slices` | 建立 job |
| POST | `/api/v2/slices/{id}/upload` | 上傳 STL |
| PUT | `/api/v2/slices/{id}/config` | 設定切片參數 |
| POST | `/api/v2/slices/{id}/execute` | 開始切片 |
| GET | `/api/v2/slices/{id}` | 查詢 job 狀態 |
| GET | `/api/v2/slices/{id}/uchars` | 取得層數資訊 |
| GET | `/api/v2/slices/{id}/layers.zip` | 下載層圖 ZIP (直接回傳 .sl1) |
| GET | `/api/v2/slices/{id}/preview.zip` | 下載縮小版 WebP 預覽 |
| POST | `/api/v2/slices/{id}/download.prz` | 產生並下載 PRZ 檔 |
| GET | `/api/v2/slices/{id}/gcode` | 取得 G-code metadata |
| GET | `/api/jobs/{id}/layers/{idx}.png` | 取得單層 PNG (fallback) |

## 9. 關鍵設計決策

1. **layers.zip 直接回傳 .sl1**：.sl1 本身就是 PNG 的 ZIP，每張 PNG 約 4.5KB（SLA 切片圖壓縮率極高），595 層只有 2.7MB。零伺服器處理時間。

2. **PRZ 在 download 時才產生**：PRZ 依賴使用者設定（曝光、抬升速度等），無法預先產生。但 RLE 編碼的圖片資料與設定無關。

3. **preview.zip 為 fallback**：需要 PIL resize + WebP encode，595 層需 ~12 秒。僅在 layers.zip 不可用時使用。

4. **Frontend fallback chain**：layers.zip → preview.zip → 個別 PNG，確保任何環境都能顯示預覽。

5. **PRZ download fallback**：後端 download.prz → 前端 WASM (Mechado)，確保離線也能產生 PRZ。
