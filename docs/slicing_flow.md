# Slicing Button 與 Preview 下載流程（zh_TW）

本文整理使用者從按下 `Slice` 按鈕到進入 `Preview`，以及在 `Preview` 頁按下 `Download` 後的完整執行步驟。
本文由AI生成，僅供參考。

## 1. 入口：按下 Slice 按鈕

觸發位置：`src/components/features/slicing/SlicerButton.vue` 的 `handleSlice()`。

1. 使用 `paramsStore.submitParams()` 驗證目前 UI 參數。
2. 若驗證失敗：
   1. 顯示錯誤 toast（`Invalid parameters`）。
   2. 流程中止。
3. 若驗證成功：
   1. 開啟 slicing progress dialog（`slicingDialog = true`）。
   2. 呼叫 `sliceModel({ three })`（`src/services/slicingService.js`）。

## 2. `sliceModel()` 決定走後端或前端

`sliceModel()` 會先把 UI 參數轉為 `mechadoConfig`，再依 `backendStore.effectiveMode` 分支：

- `backend`：走後端切片流程 `runBackendSlice()`。
- 非 `backend`：走前端切片流程 `runFrontendSlice()`（`three.slice()`）。

若原本走後端，但遇到「無 response 的錯誤」（例如連線中斷），會先做健康檢查；健康檢查失敗時會 fallback 到前端切片。

## 3A. 後端切片流程（`runBackendSlice()`）

1. 取得待切片模型：`three.getSelectedObjectForSlicing()`。
   1. 若有 support mesh 且與目前模型對應，會先掛回模型節點，確保一起輸出。
2. 匯出 STL：`three.exportSTL(selectedObject)`。
3. 確保有可用 slicing job（`ensureSlicingJob()`）：
   1. 若同一模型已有 job，重用 jobId。
   2. 否則建立新 job：`POST /api/v2/slices`。
   3. 上傳 STL：`POST /api/v2/slices/{jobId}/upload`。
4. 轉換 UI 參數為 backend slicing config：`adapters.uiToBackendSlicingConfig(...)`。
5. 更新 job config：`PUT /api/v2/slices/{jobId}/config`。
6. 觸發切片：`POST /api/v2/slices/{jobId}/execute`。
7. 輪詢 job 狀態直到完成：`pollJobUntilComplete()`（每 500ms、timeout 300s）。
8. 取得層數資訊：`GET /api/v2/slices/{jobId}/uchars`。
9. 下載每層 PNG：`GET /api/jobs/{jobId}/layers/{index}.png`。
   1. 前端會做一次左右翻轉後存入 `pngBlobs`。
10. 取得 gcode metadata：`GET /api/v2/slices/{jobId}/gcode`。
11. 組合回傳結果（重點）：
   1. `pngBlobs`（預覽/下載層圖）。
   2. `gcode`。
   3. `printData`（列印時間、體積、層高）。
   4. `prepareDownloadAssets`（延遲準備下載資產的函式）。
   5. `slicingPayload`。

### 後端流程的延遲下載資產（`prepareDownloadAssets`）

第一次被呼叫時才做：

1. 用 `takeSliceSnapshots()` 產生 preview 圖（blob）與（PRZ 模式下）raw RGB。
2. 若匯出格式是 `prz`：
   1. 把 backend PNG layers 轉為 mask/RLE。
   2. 餵給 Mechado 模組產 PRZ bytes。
3. 快取結果並回傳 `{ previewImage, previewImage_cropped, przString }`。

## 3B. 前端切片流程（`runFrontendSlice()` → `three.slice()`）

實作位於 `src/three/managers/SlicerManager.js` + `src/workers/slicerWorker.js`。

1. 先對選取模型拍 preview snapshots。
   1. `zip` 模式取 blob。
   2. `prz` 模式取 rawRGB。
2. 收集模型幾何頂點（包含子 mesh）。
3. 建立 slicer worker，送入：verts、matrix、config、bedSize、resolution、exportFileType、previewImgData。
4. worker 內：
   1. 載入 Mechado WASM。
   2. 匯入 config 與 model。
   3. 執行 `Slice_MultiThread_JS()`。
   4. 取 `pixelSurfaces` 並轉成 `pngBlobs`。
   5. 取 `gcode` 與 `printData`。
   6. 若 `prz`：再生成 `przString`（bytes）。
5. 回主執行緒後，補上：
   1. `jobId`（模型名稱去掉 `.stl`）。
   2. `previewImage`、`previewImage_cropped`。

## 4. 切片成功後（回到 `SlicerButton.handleSlice`）

1. 把結果寫入 `slice store`（`src/stores/slice.js` 的 `sliceJob`）：
   - `pngs`, `id`, `pixelSurfaces`, `gcode`, `previewImage`, `previewImage_cropped`, `printData`, `przString`, `prepareDownloadAssets`, `slicingPayload`。
2. 關閉進度對話框。
3. 顯示 `Slicing completed`。
4. 導頁到 `/preview`。

## 5. 進入 Preview 頁

觸發位置：`src/views/PreviewPage.vue` 的 `onMounted()`。

1. 若 `sliceJob.pngs.length > 0`：顯示第一張 layer 圖。
2. 若沒有 PNG：直接導回首頁 `/`。

## 6. 在 Preview 按下 Download 後的流程

觸發位置：`SplitButton` 的 `Download` command → `downloadFiles()`。

1. `isDownloading = true`。
2. 先呼叫 `printStore.prepareDownloadAssets()`：
   1. 若 `sliceJob.prepareDownloadAssets` 是函式才執行（常見於後端流程）。
   2. 可能更新 `previewImage`、`previewImage_cropped`、`przString`、`gcode`。
3. 分支判斷：
   1. 若 `sliceJob.przString` 有值：
      1. 呼叫 `createPRZ()`。
      2. 以 `Blob(application/octet-stream)` 建檔。
      3. 用 `saveAs` 下載 `${sliceJob.id}.prz`。
   2. 否則（ZIP 路徑）：
      1. 呼叫 `createSlicedZip()`。
      2. `createPNGs()`：
         1. 若已有 `sliceJob.pngs` 直接用。
         2. 否則用 `pixelSurfaces` 透過 `processLayers()` 轉 PNG。
      3. `buildZipGcode()`：
         1. 用 `slicingPayload + totalLayers` 重新產生 gcode。
         2. 若失敗且已有 fallback gcode，使用 fallback。
      4. `createZip()` 產出 zip blob，內容包含：
         1. `1.png`, `2.png`, ...
         2. `run.gcode`
         3. `preview.png`（若存在）
         4. `preview_cropping.png`（若存在）
      5. `downloadZip(zip, jobId)` 下載 `${jobId}.zip`。
4. `finally`：`isDownloading = false`。

## 7. 例外與失敗處理重點

1. 切片失敗：
   1. `handleSlice()` 會顯示 `Slicing failed` toast。
   2. progress dialog 關閉。
2. 下載失敗：
   1. `downloadFiles()` 會 `console.error(error)`。
   2. `isDownloading` 仍會在 finally 還原。
3. 後端切片錯誤：
   1. 會更新 backend job 狀態為 `FAILED`。
   2. 視錯誤型態決定是否 fallback 前端切片。

## 8. 重要資料在流程中的流向

1. `slicingPayload`：供 ZIP 路徑重新輸出 gcode（對齊當次切片層數）。
2. `prepareDownloadAssets`：延後到真正下載時才補 preview / PRZ，減少切片當下等待時間。
3. `pngs` 與 `pixelSurfaces`：
   1. `pngs` 優先用於預覽與下載。
   2. `pixelSurfaces` 作為 ZIP 補算 PNG 的備援資料。
