# 切片效能分析

> 日期：2026-03-11
> 環境：Mac Studio (Apple Silicon, ~20 cores)
> PrusaSlicer：v2.9.4 fork (支援 --export-preview-pngs, anti-aliasing, blur)

---

## 1. PrusaSlicer CLI Benchmark

### 測試環境
- 印表機解析度：5760 × 3600（牙科 MSLA）
- 層高：0.05mm
- Anti-aliasing：開啟

### 結果

| 模型 | STL 大小 | 層數 | Wall Time | CPU Time | 核心利用率 | SL1 大小 | PNG 總量 |
|------|---------|------|-----------|----------|-----------|---------|---------|
| model_support (含支撐) | 54MB | 460 層 | **8.3s** | 63.5s | ~7.7x | 4.6MB | 12MB |
| 004_p (牙模) | 16MB | 830 層 | **3.6s** | 54.5s | ~15x | 253KB | 15MB |
| 003_p (牙模) | 12MB | 712 層 | **3.2s** | 46.1s | ~14.6x | 217KB | 13MB |
| model_support (2560×1440) | 54MB | 460 層 | **8.1s** | 47.4s | ~5.9x | 11MB | 11MB |
| model (33MB, 5760×3600) | 33MB | 953 層 | **4.2s** | 63s | ~15x | 5.0MB | 22MB |
| model (19MB, 5760×3600) | 19MB | 587 層 | **2.2s** | 29s | ~13x | 2.9MB | 13MB |

### 觀察

1. **Mac Studio 多核加速顯著** — CPU 時間 30-60s，但 wall time 只有 2-8s
2. **模型複雜度 > 模型大小** — 54MB 模型（三角面多）的核心利用率較低（7.7x vs 15x），因為幾何計算無法完全並行
3. **Rasterization 是主要瓶頸** — 佔 73-100% 的進度步驟，這是光柵化每一層截面的過程
4. **PNG 壓縮效率高** — 12-22MB 的 PNG 壓成 SL1 (ZIP) 只有 0.25-5MB

---

## 2. 完整切片流程分析

```
STL 上傳 → PrusaSlicer CLI → .sl1 (ZIP of PNGs) → 前端下載 → PNG decode → RLE → PRZ
```

### 各階段耗時估算（典型模型 ~20MB STL, 600 層）

| 階段 | 耗時 | 執行位置 | 瓶頸 |
|------|------|---------|------|
| STL 上傳 | 1-3s | 前端→後端 | 網路 |
| PrusaSlicer 切片 | 2-4s | 後端 CLI | CPU (rasterization) |
| SL1 產出 (ZIP) | 含在上面 | 後端 | I/O |
| 前端下載 layers.zip | 1-2s | 後端→前端 | 網路 |
| PNG decode + RLE (4 Workers) | 2-5s | 前端 Web Workers | CPU |
| PRZ 打包 | <1s | 前端 | 記憶體 |
| **總計** | **~8-15s** | | |

---

## 3. XOR Delta Encoding 評估

### 概念
相鄰層圖像高度相似，只儲存與前一層的 XOR 差異。

### Benchmark 結果
- 單層 XOR 運算 (Uint32, 5760×3600): **~4.5ms**
- Keyframe 策略：每 50 層存完整幀，確保隨機存取效能
- 理論壓縮率：層間差異通常 <5%，可達 **95%+ 壓縮率**

### 結論：XOR 不值得在此場景實作

| 面向 | 分析 |
|------|------|
| 切片速度 | **無幫助** — rasterization 需要完整計算每層幾何，XOR 無法跳過 |
| PNG 編碼 | 微小幫助 — XOR 後的差異圖 PNG 壓縮更小，但 PNG 編碼不是瓶頸 |
| 傳輸大小 | 有幫助但非必要 — SL1 已經只有 0.25-5MB，傳輸不是瓶頸 |
| 實作複雜度 | 高 — 需改 PrusaSlicer C++ 或後端 Python，加上前端解碼邏輯 |
| 隨機存取 | 需 keyframe 策略，增加複雜度 |

---

## 4. 真正有效的優化方向

### 4.1 已完成的優化
- [x] 後端整合 ortho pipeline（減少多次 CLI 呼叫）
- [x] 前端 4 Worker 並行 PNG decode + RLE
- [x] 前端 ZIP 下載取代逐層 fetch
- [x] 後端 preview_service 用 ThreadPoolExecutor (8 workers)

### 4.2 可考慮的優化

| 優化 | 預期效果 | 難度 | 優先級 |
|------|---------|------|--------|
| **Polling → SSE/WebSocket** | 減少進度輪詢延遲 | 低 | 中 |
| **後端直接產 PRZ** | 前端不需 PNG decode + RLE，直接下載 PRZ | 中 | 高 |
| **後端 PRZ streaming** | 邊切片邊送出 PRZ 資料 | 高 | 低 |
| **RLE 用 WASM** | 取代 JS Worker 的 RLE 編碼 | 中 | 低 |
| **SL1 → PRZ 後端管道** | 省去前端下載 layers.zip 再上傳 PRZ | 低 | 高 |

### 4.3 建議優先順序

1. **後端直接產 PRZ** — 最大效益，省去前端 PNG→RLE 的 2-5s + 往返傳輸
   - 後端已有 `prz_encoder.py`（numpy 向量化 RLE）
   - 切片完直接產 PRZ，前端只要下載一個檔案

2. **Polling → SSE** — 切片進度即時推送，改善使用者體驗

3. **其他** — 目前效能已足夠（8-15s 完成整個流程），不需過度優化

---

## 5. 不同部署環境的考量

| 環境 | 切片速度 | 說明 |
|------|---------|------|
| Mac Studio (目前) | 2-8s | 多核高效能，切片不是問題 |
| 雲端 VM (未來) | 10-30s | 核心數少，rasterization 會慢 |
| 用戶電腦 (WASM) | 30-120s | 單執行緒，最慢 |

**雲端部署時**，切片速度會變成瓶頸，屆時「後端直接產 PRZ」的優化就更有價值。
