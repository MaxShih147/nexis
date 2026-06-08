# Web Slicer 全應用知識庫 Knowledge Base

> 用途：團隊/簡報/客戶對應的「背景知識總整理」，供完整研讀記憶。
> 資料來源：直接擷取自 DS-Online 前端與 web_slicer_core 後端**程式碼/設定檔**，附 `檔案:行` 依據；程式碼裡沒有的物理規格一律標「**待補**」，未臆測。
> 術語：中文為主、專有名詞中英並陳。
> ⚠️ = 該功能目前在 feature 分支、尚未合進 dev。

---

## 目錄
1. 產品總覽與架構
2. 機台 Machines
3. 樹脂系統 Resins
4. 牙科模式 Dental Modes（四種）
5. 列印參數 Print Parameters
6. 軟體功能 Features
7. 處理管線 Pipelines（前端 vs 後端）
8. 輸出格式 Output Formats
9. 後端 API 一覽
10. 術語表 Glossary
11. 待補清單

---

# 1. 產品總覽與架構

- **定位**：瀏覽器型牙科切片解決方案 Browser-based Dental Slicer（Phrozen）。整合「機台 Printer + 樹脂 Resin + 軟體 Software」。
- **架構（混合 Hybrid）**：
  - **雲端 Cloud**：模型/切片檔儲存 + 帳號系統 Account System（前端對 db/udp API 帶 `Bearer` token）。
  - **本機 Local Agent**：切片等重運算跑在使用者電腦的 local agent（後端 `web_slicer_core/agent`，打包成 .exe）；slicer API 無認證（localhost-only）。
- **前端**：Vue 3 + Pinia + Three.js（`/Users/max/repo_claude/DS-Online`）。
- **後端**：Python FastAPI + PrusaSlicer fork CLI + manifold3d/trimesh（`/Users/max/repo_claude/web_slicer_core/agent`）。
- **i18n**：支援 en / cn / tw / ja（`src/i18n/translation.js`）。

---

# 2. 機台 Machines

完整支援機種（讀自 `src/data/resin_profiles/index.json` 全檔）。建構尺寸 Build Volume = X×Y×Z(mm)；解析度 Resolution = X×Y(px)；像素 Pixel = 建構/解析度(mm/px)。

| 機種 Model | slug | 建構尺寸 (mm) | 解析度 (px) | 像素 (mm/px) | 鏡像 | 樹脂檔數 |
|---|---|---|---|---|---|---|
| Sonic 4K 2022 | `sonic_4k_2022` | 134.4 × 75.6 × 200 | 3840 × 2160 | 0.035 | 1 | 112 |
| Sonic XL 4K | `sonic_xl_4k` | 192.0 × 120.0 × 200 | 3840 × 2400 | 0.050 | 1 | 66 |
| Sonic XL 4K 2022 | `sonic_xl_4k_2022` | 199.68 × 124.8 × 200 | 3840 × 2400 | 0.052 | 1 | 115 |
| Sonic XL 4K Plus | `sonic_xl_4k_plus` | 199.68 × 124.8 × 200 | 3840 × 2400 | 0.052 | 1 | 111 |
| Sonic CS+ | `sonic_cs_plus` | 165.79 × 71.28 × 175 | 7536 × 3240 | 0.022 | 1 | 32 |
| Sonic CS+ Mini Plate | `sonic_cs_plus_mini_plate` | 165.79 × 71.28 × 175 | 7536 × 3240 | 0.022 | 1 | 31 |
| Sonic LS+ | `sonic_ls_plus` | 195.84 × 122.4 × 175 | 5760 × 3600 | 0.034 | 1 | 16 |
| Sonic LS+ Mini Plate | `sonic_ls_plus_mini_plate` | 195.84 × 122.4 × 175 | 5760 × 3600 | 0.034 | 1 | 16 |
| Lumii DLP 2K | `lumii_dlp_2k` | 130.0 × 73.0 × 160 | 2560 × 1440 | 0.051 | 1 | 40 |
| Lumii DLP 2K Mini Plate | `lumii_dlp_2k_mini_plate` | 130.0 × 73.0 × 160 | 2560 × 1440 | 0.051 | 1 | 32 |

- **樹脂檔變體總數：571**（所有機種加總）。
- **Mini Plate**：縮小列印平台版本（省料/小批量）；建構尺寸同母機，差在 `margin_buffer`（邊界內縮較大）。
- **像素越小越精細**：Sonic CS+ 0.022mm 最細，Sonic XL 系列 0.05~0.052mm。
- **建構盒計算**（`src/three/buildVolume.js`）：平台置中於 XY 原點，`min=(-W/2, -H/2, 0)`、`max=(W/2, H/2, depth)`；`DEFAULT_BUILD_VOLUME_MIN_Z = 0`（平台在世界 z=0）。

**待補（code 沒有、客戶會問）**：光源波長（一般 405nm）、技術別（LCD vs DLP；Lumii 為 DLP）、光強度 mW/cm²、Z 軸精度、認證（CE/FDA/日本 PMDA）。

---

# 3. 樹脂系統 Resins

## 3.1 規模與品牌
- 10 機種、**571 組樹脂變體**；`ortho_modes.json` 記錄 **20 品牌、165 種品牌×材料組合**。
- 品牌：Phrozen Dental（自家）、BEGO、Detax、Dentona、Dreve、NextDent、Keystone、Pacdent、HARZ Labs、Graphy、Whipmix、Vericom、Saremco、Aidite、BJM LAB、Enlighten、JamgHe×Phrozen、YAMAHACHI、Phrozen/Phrozen Engineering（工程材，未分類牙科模式）。

## 3.2 樹脂檔結構（`<machine_slug>.json`）
階層：`printer_name` → `profiles[]`（每組 = 品牌×材料）→ `thickness_configs[]`（每個層高，如 30/50/100µm）→ `modes[]`（stable / fast / customize）→ 每個 mode 內含全部列印參數。

**Profile 層欄位**：`brand_name`、`resin_name`、`export_type`（16648=ZIP）、`dimensions{x,y,z}`、`image_mirror`、`resolution{x,y}`、`margin_buffer{x,y}`。

**Mode 層關鍵欄位**（範例值取自 sonic_xl_4k_plus.json 30µm/stable）：

| 欄位 | 範例 | 意義 | 單位 |
|---|---|---|---|
| `mode` | "stable" | 模式別 stable/fast/customize | — |
| `ratio{x,y,z}` | 1.006/1.005/1.006 | 各軸尺寸補償比（收縮補償） | 倍率 |
| `two_stage` | 1 | 1=兩段式抬升/回程 | — |
| `base_layers` | 6 | 底層數 | 層 |
| `base_curing_time` | 25.0 | 底層曝光 | s |
| `normal_curing_time` | 2.5 | 一般層曝光 | s |
| `base_lift_height` / `normal_lift_height` | 8.0 / 7.0 | 抬升高度 | mm |
| `base_peel_speed` / `normal_peel_speed` | 50 / 50 | 抬升(剝離)速度 | mm/min |
| `base_return_speed` / `normal_return_speed` | 100 / 100 | 回程速度 | mm/min |
| `normal_wait_before/after_print`、`normal_wait_lift` | 1/0/0 | 曝光前後、抬升後等待 | s |
| `buffer_layer_number` | 5 | 過渡層數 | 層 |
| `light_pwm` / `bottom_light_pwm` | 255 / 255 | 光強 PWM | 0–255 |
| `grayscale_level` | 1 | 灰階等級 | — |
| `*_second_*` | 0 | 兩段式的第二段距離/速度 | mm, mm/min |
| `compensate_size{default,customize}{in,out,in_base,out_base}` | 0 | 內/外尺寸補償 | mm |
| `gcode{start,mid,end}` | … | 機台 GCode 範本（含 {image}{rise_pos}… 佔位） | — |
| `timelapse{enabled,interval_layers,move_speed}` | 0/1/70 | 縮時 | — |

## 3.3 品牌 × 材料 → 牙科模式（`ortho_modes.json`）
出現的 `__dental_mode` 值共 12 種（含未在 UI 開放者）：`Dental Model`、`C&B`、`Casting`、`Denture Base`、`Surgical Guide`、`Splint`、`Tray`、`Gingiva`、`Indirect Bonding Tray`、`Study Model`、`Try-In`、`All on X`、`null`(工程材)。

代表性對照（記憶用）：
- **Dental Model**：Phrozen Washable/Ortho Model、Dentona Optiprint Model、NextDent Model、Keystone KeyModel…
- **C&B**：BEGO VarseoSmile Crown、Detax Freeprint Crown、NextDent C&B MFH、Saremco Crowntec…
- **Splint**：Detax Freeprint Splint 2.0、NextDent Ortho、Keystone KeySplint、Pacdent Rodin Splint…
- **Surgical Guide**：Dentona Optiprint Guide、Dreve FotoDent Guide、NextDent SG、Pacdent Rodin Surgical Guide…
- 其他模式（Casting/Denture Base/Gingiva/Tray/IBT/Try-In/All on X）有材料對應，但**UI 只開放 4 種主模式**，其餘走預設行為。

---

# 4. 牙科模式 Dental Modes（四種）

> 來源：`src/constants/orthoModes.js`、`MeshManager.js`、`auto_orient_*`、`ortho_pipeline.py`。

## 4.1 模式定義與選擇
- 四種主模式 + 代碼：**Dental Model=0（預設）、Splint=1、Surgical Guide=2、C&B=3**。
- **模式由樹脂帶動**：讀樹脂檔的 `__dental_mode`（`useParamsStore.js` 的 `dentalMode` computed），**唯讀、不可逐模型手選**；換模式 = 換樹脂。
- 正規化：`'Orthodontic Model'` → `'Dental Model'`（legacy 別名）。

## 4.2 自動定位 Auto-Orient 派工
- **Surgical Guide（2）→ 後端**：前端 `autoOrientSurgGuide(stl, 2, debug)` → `POST /api/v2/auto-orient`（`api_v2.py:1162`），回傳 `rotation_rad=[rx,ry,rz]`。
- **其餘（0/1/3）→ 瀏覽器內 WASM**：`dao.computeAutoOrientation({vertices,indices}, module)`（`dao.wrap.js`），C++ 源碼在 `wasm-impl/Orientation/Orientation/src/`。
- 旋轉以 Three.js Euler **'ZYX'** 套用，之後 `setToBottom()` 貼平台。

## 4.3 各模式詳解

### ① Dental Model（牙模，預設）
- **臨床**：診斷/工作牙模。
- **定位演算法**（`auto_orient_core.cpp` `compute_auto_orientation_Orthodontic_mod`）：找**面積最大的共平面面群**（依法向量分箱 + 平面距離分箱、取面積總和最大），把該法向量轉到 **-Z 朝下** → 最大底面貼平台。
- **處理**：可選挖空（前端 quick 或後端 ortho 管線）。

### ② Splint（咬合板/維持器，code 1）
- **臨床**：咬合板、矯正維持器（薄殼件）。
- **定位**：WASM `auto_orient_splint.cpp`，策略類似牙模但針對薄殼調整。
- **處理**：可選挖空。

### ③ Surgical Guide（手術導板，code 2）— 最複雜，走後端
- **臨床**：植牙/手術鑽孔導板。
- **演算法**（`auto_orient_surg_guide.py`，多階段）：
  1. 頂點熔接、建邊鄰接（1e-4mm 量化）
  2. 平面 patch 區域成長（法向夾角 ≤ 2°）
  3. **鑽孔端面偵測**：直徑 5.5–14.0mm、長短軸比 ≤ 1.5（圓形）、體素掃描偵測「實→空(≥2.4mm)→實」孔洞、邊界牆連通需累積轉角 ≥ 220°（封閉環）
  4. 多候選時以法向一致性挑最佳
  5. **入口方向判定**：用凹面（貼牙側）投票決定哪端朝下（入口朝下）
  6. 算 Euler 角對齊 -Z
- **debug 輸出**：decision/step/candidate/concave faces + drill cylinders（前端疊色顯示）。
- 偵測不到孔 → 回 `[0,0,0]`、`found=False`，或退回凹面朝上判斷。

### ④ C&B（牙冠牙橋，code 3）
- **臨床**：假牙冠、牙橋（小件高精度）。
- **定位**：WASM `auto_orient_temp_cb.cpp`，針對小件/最少支撐調整。
- **處理**：通常不挖空（小/實心）。

---

# 5. 列印參數 Print Parameters

> 共 **~54 個可調參數**（`src/params/uiSchema.js` FIELD_DEFS）。儲存用 UI 單位（mm、s、mm/min），匯出時透過 `mappingTables.js` 轉後端格式。預設種子取自 `sonic_ls_plus.json`。

## 5.1 曝光與層 Exposure & Layers
| 參數 中/英 | UI path | 單位 | 範圍 | 預設 |
|---|---|---|---|---|
| 層高 Layer Height | print.layerHeight | mm | 0.001–5000 | 0.05 |
| 曝光時間 Exposure Time | print.exposure | s | 0.001–5000 | 2.5 |
| 底層曝光 Bottom Exposure | print.bottom.exposure | s | 0.001–5000 | 35 |
| 底層數 Bottom Layer Count | print.bottom.layers | 層 | 1–5000 | 5 |
| 過渡層數 Transition Count | print.transition.count | 層 | 1–5000 | 5 |
| 關燈延遲 Light-off Delay | print.lightOffDelay | s | 0–5000 | 選填 |

## 5.2 運動 Motion（一般層；底層為 `motion.bottom.*` 同結構）
| 參數 中/英 | UI path | 單位 | 範圍 | 預設 |
|---|---|---|---|---|
| 抬升距離 Lift Height | motion.normal.liftHeight | mm | 0.01–5000 | 6 |
| 抬升速度 Lift Speed | motion.normal.liftSpeed | mm/min | 0.6–5000 | 60 |
| 抬升第二段距離/速度 Lift 2nd | motion.normal.liftSecond* | mm / mm/min | 0–5000 | 選填 |
| 回程距離 Retract Distance | motion.normal.retractDistance | mm | 0–5000 | 選填 |
| 回程速度 Retract Speed | motion.normal.retractSpeed | mm/min | 0.6–5000 | 100 |
| 回程第二段 Retract 2nd | motion.normal.retractSecond* | mm / mm/min | 0–5000 | 選填 |
| 抬升前停留 Rest Before Lift | print.restBeforeLift | s | 0–5000 | 選填 |
| 抬升後停留 Rest After Lift | print.restAfterLift | s | 0–5000 | 選填 |

- **速度單位**：UI 存 mm/min；匯出切片設定時 `mmPerMinToMmPerSec`（÷60）轉 mm/s。
- **回程距離兩欄約束**：欄1 = `liftHeight + liftSecondDistance − retractDistance`（不可 < 0）；欄2 = `retractDistance`；兩欄不可同時為 0。

## 5.3 進階 Advanced
| 參數 中/英 | UI path | 單位/值 | 轉換 |
|---|---|---|---|
| 光強 Light PWM / 底層 Bottom Light PWM | advanced.lightPWM / bottomLightPWM | 0–255 | id |
| 抗鋸齒 Anti-aliasing Level | advanced.antialiasingLevel | UI 2/4/8 | ↔ 後端 0/1/2 |
| 灰階 Grey Level | advanced.greyLevel | 0–8 | id |
| 邊緣模糊 Image Blur (enable + pixel) | advanced.imageBlur* | UI 2–8 px | ↔ 後端 1–7（0=關） |
| 內補償 Inner Compensate | advanced.innerCompensate | mm | id |
| 外補償 Outer Compensate | advanced.outerCompensate | mm | id |

## 5.4 GCode 範本
`gcode.start / mid / end`（純文字，一般使用者不動）。`mid` 含佔位 `{image}{rise_pos}{rise_speed}{fall_pos}{fall_speed}{light_delay}{exposure_time}{light_pwm}{machine_height}`。

## 5.5 參數調整方向（看到問題往哪調）★ = 重點
- **★曝光時間 / 光強 PWM**：固化不足(掉件/層不黏) → 加；過固化(尺寸偏大/細節糊/孔變小) → 減。牙科要精準，傾向「略減 + 補償」收斂。
- **★底層曝光 / 底層數**：脫落/翹曲 → 加；象腳效應(底外擴)/難取下 → 減，並用**過渡層**讓固化平順過渡。
- **★抬升高度/速度（含兩段式）**：大平面/脆弱件剝離失敗 → 降速、適度加高度、用兩段式（前段慢剝離、後段快回位）。
- **★停留 / 關燈延遲**：大截面層缺料/空洞 → 增加抬升後停留；追速度且小件 → 縮短。
- **★內/外補償 + 收縮比**：成品普遍偏大 → 加外補償(外縮)；孔/內徑偏小 → 調內補償；等比偏差 → 用 ratio x/y/z。**牙冠/導板務必實測校正一次。**
- **層高**：薄(0.03)=細緻慢；厚(0.05)=快粗。牙模常 0.05、高細節 0.03。
- **抗鋸齒/邊緣模糊/灰階**：柔化像素邊緣 → 曲面更平滑、尺寸更線性。

---

# 6. 軟體功能 Features

## 6.1 匯入與場景 Import & Scene
- 多格式匯入：**STL / OBJ / 3MF**（`src/three/loaders/`）；STL 完整性驗證。
- 多模型 Multi-model：一次載多件、共同排版/切片。
- 變換 Gizmo：平移/旋轉/縮放（`ControlsManager`）；模型資訊（尺寸/頂點/面數）。
- 軌道相機、拖放上傳。
- 快照 Snapshot：幾何快照存 IndexedDB（供 undo），背景 worker I/O。

## 6.2 自動定位 Auto-Orient
- 牙模/Splint/C&B 走瀏覽器 WASM；Surgical Guide 走後端鑽孔面偵測（見 §4）。

## 6.3 幾何編輯 Geometry Editing
- **挖空 Hollowing**：後端 PrusaSlicer `--export-hollow-stl`，參數壁厚/品質/封閉距離；前端可預覽、可還原。
- **鑽孔 Drilling (CSG)**：點擊放圓柱、拖曳調半徑；布林相減（manifold3d 後端 / three-bvh-csg 前端）。
- **文字浮雕 Text Emboss**：擠出文字 → 布林聯集刻到模型；可調大小/深度/位置。
- **切割 Cut**：PrusaSlicer `--cut` 依 Z 高切，keep_mode = both/upper/lower。
- **面選取 Face Selection / 剖面 Clipping Plane**：點選面高亮；Z 剖面檢視。
- **底座生成 Base Generation**：偵測邊界→定位→擠出牆+底面（牙弓開放邊界）。

## 6.4 牙科/矯正處理管線（見 §7）
挖空→底部延伸→蜂巢→排水孔→側壁排水→布林，一鍵輸出。

## 6.5 支撐 Support
- 後端 PrusaSlicer `--export-support-stl`；參數：支撐頭直徑、柱徑、臨界角 Critical Angle、點密度、底座 pad；可預覽、可單獨下載 STL。

## 6.6 視覺輔助 Visual Aids
- **超界 Out-of-bounds**：超出建構盒紅色半透明（shader 逐片元）。
- ⚠️ **貼平台接觸面 Contact Highlight**：貼 z=0 的面染綠（feature 分支 `feature/dental-uneven-bottom-orient`，尚未進 dev）。
- 鑽孔預覽、Ortho 預覽配色（hollow/hex/drain/sidewall）、座標軸 helper。

## 6.7 編修安全 Undo/Redo
- `UndoManager`：堆疊（預設上限 50）、300ms 內合併（拖曳合一步）、交易 Transaction 批次、刪模型清該 UUID 命令。

## 6.8 切片/預覽/估算 Slicing/Preview/Estimation
- 切片：PrusaSlicer CLI → 輸出 SL1（+ 可選 preview PNG 0.25 縮放）。
- 逐層預覽：SL1 取層、preview.zip 為 WebP 縮圖（背景 ThreadPool 轉檔）。
- **預估列印時間**（PRZ 物理公式為準，含抬升/回程/曝光/等待）、**樹脂體積 mL/mm³**。

---

# 7. 處理管線 Pipelines

## 7.1 前端快速處理 `autoProcess()`（`MeshManager.js`）
適用牙模/Splint：自動定位 → `runOpenBottom`（開底+偏移殼）→ `hollowGeometry`（挖空腔）→ 旋轉貼平台 → 標記 `hollowed`。屬「快速本地殼」。

## 7.2 後端整合 Ortho 管線（`ortho_pipeline.py`，10 步）
模式無關，使用者於 Ortho UI 觸發；U 型牙弓（低截面填充比 < 0.80）會**跳過挖空**。
1. 挖空 Hollow（PrusaSlicer）
2. 底部頂點延伸 Extend Bottom（距底 `bottom_z_threshold` 內下移 `extension_distance`）
3. 對齊 hollow 到輸入
4. 蜂巢格 Hex Grid（射線適配高度）
5. 排水孔 Drain Holes（蜂巢牆邊圓柱）
6. 側壁排水 Side-wall Drains（Z 截面取樣、12 扇區評分、≥6mm 間距）
7. 聯集(hex, drains)
8. 翻面 hollow ∩ 步驟7
9. 聯集(側壁排水, 步驟8)
10. **差集(原模型 − 步驟9)** → `ortho_result.stl`

參數：`hollowing_min_thickness/quality/closing_distance`、`bottom_z_threshold`、`extension_distance`、`hex_cell_radius/wall_thickness/grid_count/pyramid_height`、`drain_hole_radius`。

---

# 8. 輸出格式 Output Formats

| 格式 | 說明 |
|---|---|
| **PRZ** v3.0 | 機台專用二進位；RLE 壓縮層、含預覽圖(116²/290²)、列印時間、樹脂量、回程覆寫；純 Python encoder；可解析/逐層解碼 |
| **SL1** | PrusaSlicer 輸出的層 PNG ZIP；可逐層或整包下載 |
| **STL 多件** | hollow / hollow_aligned / support / hex_grid / drain_holes / cut / ortho_result / boolean |
| **.3mf 專案** | 場景所有模型 + 變換存檔（ProjectManager）；檔名含日期時區 |
| **preview.zip** | WebP 縮圖供快速預覽 |

---

# 9. 後端 API 一覽（`api_v2.py`）

- **切片/任務**：`POST /slices`、`PUT /slices/{id}/config`、`POST /slices/{id}/models`、`POST /slices/{id}/upload`、`POST /slices/{id}/use-model-from/{src}`、`POST /slices/{id}/execute`、`GET /slices/{id}`
- **幾何操作**：`POST /slices/{id}/generate-supports`、`/generate-hollow`、`/cut`、`/extend-bottom`、`/generate-hex-grid`、`/generate-drain-holes`、`/ortho-process`
- **布林/牙科工具**：`POST /boolean`、`POST /detect-boundary`、`/smooth-boundary`、`/apply-boundary`、`/generate-base`、`/auto-orient`
- **下載**：`GET /jobs/{id}/{support|hollow|hex_grid|drain_holes|ortho_result|boolean}.stl`、`/layers/{idx}.png`、`/layers.zip`、`/preview.zip`、`POST /download.prz`
- **PRZ**：`POST /prz/parse`、`GET /prz/{sid}/layer/{i}`、`DELETE /prz/{sid}`
- **健康**：`GET /health`
- ⚠️ 資安：slicer API 無認證（localhost-only 設計）；CORS 為白名單。

---

# 10. 術語表 Glossary（中英）

| 中文 | English | 備註 |
|---|---|---|
| 切片器 | Slicer | 把 3D 模型轉成逐層影像/機台檔 |
| 光固化 | Resin / SLA / LCD / DLP | 樹脂列印技術 |
| 建構尺寸 | Build Volume | X×Y×Z |
| 層高 | Layer Height | Z 每層厚度 |
| 曝光時間 | Exposure Time | 每層照光時間 |
| 底層 | Bottom / Base Layer | 與平台附著的起始層 |
| 過渡層 | Transition / Buffer Layer | 底層→一般層的漸變 |
| 抬升/剝離 | Lift / Peel | 每層後平台抬起 |
| 回程 | Retract | 平台回到下一層位置 |
| 兩段式 | Two-stage | 慢剝離 + 快回位 |
| 光強 | Light PWM | LED 強度 0–255 |
| 抗鋸齒 | Anti-aliasing | 邊緣平滑 |
| 灰階 | Grayscale | 抖色等級 |
| 尺寸補償 | Size Compensation | XY 內/外補償，密合關鍵 |
| 收縮比 | Shrinkage Ratio | x/y/z 等比補償 |
| 挖空 | Hollowing | 內部掏空省料 |
| 排水孔 | Drain Hole | 釋放內部樹脂 |
| 蜂巢 | Hex Grid | 內部補強格 |
| 支撐 | Support | 懸空處支柱 |
| 臨界角 | Critical Angle | 需支撐的傾角門檻 |
| 自動定位 | Auto-Orient | 自動翻到適合列印方向 |
| 象腳效應 | Elephant Foot | 底層過曝外擴 |
| 手術導板 | Surgical Guide | 植牙鑽孔導引 |
| 咬合板 | Splint | — |
| 牙冠牙橋 | C&B / Crown & Bridge | — |

---

# 11. 待補清單（請產品/材料端補上）

1. 各機種：光源波長(405nm?)、技術別(LCD/DLP)、光強度、Z 精度
2. 樹脂物化規格與認證（黏度、硬度 Shore、抗張、生物相容、SDS）
3. 機台/樹脂認證狀態（CE/FDA/日本 PMDA）
4. 公司定位一句話、日本既有客戶/案例、ROI 數據、競品比較
5. 「沒網路能否使用」的明確答案（本地 agent 切片是否可離線？雲端登入/存檔需網路？）
6. `innerCompensate / outerCompensate` 的 i18n 與建議值範圍（code 未定義 min/max）

---

*所有資料皆以程式碼/設定檔為依據擷取；如與行銷文案不一致，以產品端最終確認為準。*
