# PrinterControl 打包與分發方案分析

> 日期：2026-03-11

## 背景

WebSlicer_PrinterControl 目前用 Electron 打包，約 150-200MB。
核心功能只是 HTTP server (port 5180) + UDP 廣播 (port 3000) + WebSocket (port 65432)，
不需要 GUI，Electron 太重。

用戶需要安裝此工具才能在網頁端控制區網內的印表機。
手機端無法安裝，因此手機送印需要串 PhrozenGo 雲端 API（見 phrozengo_cloud_architecture.md）。

---

## 1. 打包方案比較

| 方案 | 大小 | 有 GUI | 說明 |
|------|------|--------|------|
| Electron (現在) | ~150-200MB | 有（系統 tray） | 包了整個 Chromium，太重 |
| pkg (by Vercel) | ~50MB | 無 | 把 Node.js + code 打包成單一執行檔 |
| nexe | ~40MB | 無 | 類似 pkg，單一執行檔 |
| Node SEA (Single Executable App) | ~40MB | 無 | Node.js 原生支援，不需第三方工具 |
| Tauri | ~5-10MB | 有（用系統 WebView） | Rust 核心，比 Electron 輕很多 |
| Neutralinojs | ~3-5MB | 有（用系統 WebView） | 更輕量的桌面框架 |
| Bun compile | ~50MB | 無 | `bun build --compile`，單一執行檔 |

**結論**：PrinterControl 不需要 GUI，用 pkg / Node SEA / Bun compile 打包成無 GUI 背景執行檔最合理。

---

## 2. 簽章問題

**所有打包方式都需要 OS 簽章**，否則：

| OS | 沒簽章的後果 |
|----|-------------|
| Windows | SmartScreen 警告「Windows 已保護您的電腦」，用戶要手動允許 |
| macOS | 直接擋掉，用戶要到設定 → 安全性手動允許 |
| Linux | 不在意簽章 |

**簽章成本**：

| 項目 | 費用 | 說明 |
|------|------|------|
| Windows Code Signing | ~$200-500/年 | 需要 EV 憑證才能不被 SmartScreen 擋 |
| macOS Developer ID | $99/年 | Apple Developer Program，含 notarization |

> Phrozen 是公司，應該已有 Apple Developer 帳號跟 Windows 簽章憑證，可直接沿用。

---

## 3. 不需要簽章的分發方式

| 方式 | 說明 | 缺點 |
|------|------|------|
| Homebrew (macOS) | `brew install phrozen-printer-control` | 只限 macOS，用戶要開 terminal |
| winget / chocolatey (Windows) | 類似 brew，package manager 安裝 | 用戶要開 terminal |
| npm global | `npm install -g @phrozen/printer-control` | 用戶要有 Node.js |

---

## 4. 完全不用安裝的方案：Chrome Extension

**最有潛力的方向**：

- 不用 OS 簽章，只要 Chrome Web Store 上架 ($5 一次性費用)
- 用戶在 Chrome Web Store 一鍵安裝
- 自動更新
- Extension 可以對區網 IP 發 HTTP/WebSocket 請求（不受 mixed content 限制）

**限制**：
- 不能做 UDP 廣播（瀏覽器 API 不支援）
- 探索印表機需改為 HTTP 掃描區網 IP 段，或讓用戶手動輸入印表機 IP
- 只限 Chrome/Chromium 瀏覽器

**待評估**：用戶手動輸入印表機 IP 是否可接受？還是自動探索是必要功能？

---

## 5. 網頁端自動偵測與下載流程

如果維持需要安裝的方案，可以優化下載體驗：

1. 用戶點「連線印表機」
2. 前端嘗試連 `localhost:5180`，偵測 PrinterControl 是否在跑
3. 如果連不到：
   - 透過 `navigator.userAgent` / `navigator.platform` 偵測 OS 和架構
   - 自動下載對應版本（`.exe` / `.dmg`）
   - 手機端顯示「請使用電腦操作」或引導安裝 PhrozenGo app
4. 如果連得到：直接進入印表機控制流程

---

## 6. 各場景送印方案總結

| 平台 | 短期方案 | 中期方案 |
|------|---------|---------|
| 桌面 (有裝 PrinterControl) | UDP service 送印 | 維持或改 Chrome Extension |
| 桌面 (沒裝) | 下載 PRZ 檔，手動傳 | Chrome Extension 或串 PhrozenGo API |
| 手機 | 無法送印 | 串 PhrozenGo 雲端 API |

---

## 7. 待決定事項

- [ ] Phrozen 是否有現成的 code signing 憑證可用？
- [ ] Chrome Extension 方案是否值得投入？
- [ ] 串 PhrozenGo 雲端 API 的優先級和時程？
- [ ] 用戶手動輸入印表機 IP 是否可接受？
- [ ] 印表機是否有 HTTP 介面可供區網掃描（取代 UDP 廣播）？
