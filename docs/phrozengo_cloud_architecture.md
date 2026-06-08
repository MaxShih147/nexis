# PhrozenGo 雲端架構分析

> 來源：PhrozenGo_AppBackend + PhrozenGo_client 程式碼分析
> 日期：2026-03-11

## 目的

分析 PhrozenGo 的雲端通訊架構，評估 DS-Online 是否能串接同一套雲端 API，
讓用戶在網頁端直接送印（包含手機），不需安裝任何桌面軟體。

---

## 1. 整體架構

```
┌──────────────┐     MQTT (SSL)     ┌──────────────────┐
│  Phrozen     │ ←────────────────→ │  EMQX Broker     │
│  3D Printer  │                    │  (AWS NLB)       │
└──────────────┘                    └────────┬─────────┘
       ↑                                     │
       │ WebRTC / TUTK (P2P)                 │ MQTT
       │                                     ↓
       │                            ┌──────────────────┐
       │                            │  PhrozenGo       │
       │                            │  Backend (NestJS)│
       │                            │  ├─ backend_app  │ ← Socket.IO → App/Web
       │                            │  ├─ backend_api  │ ← REST API
       │                            │  └─ backend_worker│ ← BullMQ jobs
       │                            └────────┬─────────┘
       │                                     │
       │            ┌────────────────────────┼──────────────┐
       │            │ Socket.IO              │ REST API      │ FCM Push
       │            ↓                        ↓              ↓
       │   ┌──────────────┐        ┌──────────────┐  ┌───────────┐
       └──→│  PhrozenGo   │        │  DS-Online   │  │  Push     │
           │  App (手機)   │        │  (潛在串接)   │  │  通知     │
           └──────────────┘        └──────────────┘  └───────────┘
```

## 2. 印表機與雲端的通訊方式

### 2.1 MQTT（核心通道）

- **Broker**: EMQX v5，部署在 K8s，前面掛 AWS NLB
- **連線**: SSL/TLS，port 1883
- **認證**: 每台印表機透過 device_register API 取得 MQTT 帳密

**Topic 結構**：
```
印表機訂閱（接收指令）: /prozen/dev/client/{SN}
後端訂閱（接收狀態）:   /prozen/dev/server/{SN}
後端廣播:               /phrozen/backend
```

**訊息格式**（JSON）：
```json
{
  "sn": "設備序號",
  "kind": "printer",        // printer | liveInfo | liveStopped | control_ack | fileList | remotePrint
  "data": {
    "ac": "state",           // 動作類型
    ...
  }
}
```

### 2.2 印表機註冊流程

1. 印表機開機，呼叫 `POST /prod-api/printer/public/device_register`
2. 帶上 `{ sn, model, supplierCode, sig (RSA簽章) }`
3. 後端回傳 `{ mqttUsername, mqttPassword, mqttHost, mqttPort }`
4. 印表機連上 EMQX broker，開始雙向通訊

### 2.3 視訊串流

| 方式 | 用途 | 協議 |
|------|------|------|
| TUTK P2P | 區網視訊 | 專有 P2P/UDP，NAT 穿透 |
| WebRTC | 遠端視訊 | 標準 WebRTC，透過 Socket.IO signaling |

## 3. 遠端送印流程

```
1. 用戶選擇檔案
   ↓
2. 檔案上傳到 AWS S3
   POST /cloud/request-upload → 取得 presigned upload URL
   POST /cloud/confirm-upload → 確認上傳完成
   ↓
3. 發送列印指令
   POST /mobile/devices/{id}/print/cloud_start  { fileId }
   ↓
4. 後端產生 S3 presigned download URL
   ↓
5. 透過 MQTT 傳送下載指令給印表機
   Topic: /prozen/dev/client/{SN}
   { kind: "remotePrint", data: { url: "s3 presigned url" } }
   ↓
6. 印表機從 S3 下載檔案並開始列印
   ↓
7. 印表機透過 MQTT 回報列印進度
   { kind: "printer", data: { state, printData: { progData: { currentNum, totalNum } } } }
   ↓
8. 後端透過 Socket.IO 推送給前端
   ↓
9. 列印完成，觸發 AWS Pinpoint 推播通知 (FCM/APNS)
```

## 4. 後端三個服務

| 服務 | Port | 職責 |
|------|------|------|
| backend_app | 3001 | App 連線、Socket.IO、MQTT 訊息處理、裝置綁定 |
| backend_api | - | 裝置註冊、狀態更新、檔案上傳、韌體更新、Lambda 整合 |
| backend_worker | - | 背景任務（BullMQ + Redis），TUTK UDID 分配 |

## 5. 關鍵 API 端點

### 裝置管理
| 端點 | 方法 | 說明 |
|------|------|------|
| `/prod-api/printer/public/device_register` | POST | 印表機註冊，取得 MQTT 憑證 |
| `/mobile/devices` | GET | 列出用戶綁定的印表機 |
| `/mobile/devices/{id}` | GET | 印表機詳情 + 歷史 |

### 列印控制
| 端點 | 方法 | 說明 |
|------|------|------|
| `/mobile/devices/{id}/print/start` | POST | 開始列印（本機檔案） |
| `/mobile/devices/{id}/print/cloud_start` | POST | 開始列印（雲端檔案） |
| `/mobile/devices/{id}/stop` | GET/POST | 停止列印 |
| `/mobile/devices/{id}/pause` | POST | 暫停列印 |
| `/mobile/devices/{id}/resume` | POST | 恢復列印 |

### 雲端檔案
| 端點 | 方法 | 說明 |
|------|------|------|
| `/cloud/request-upload` | POST | 取得 S3 presigned upload URL |
| `/cloud/confirm-upload` | POST | 確認檔案上傳完成 |
| `/cloud/list` | GET | 列出雲端檔案 |
| `/cloud/download` | POST | 取得 S3 presigned download URL |

### 視訊串流
| 端點 | 方法 | 說明 |
|------|------|------|
| `/mobile/devices/{id}/live` | POST | 啟動 TUTK 視訊 |
| `/mobile/devices/{id}/stoplive` | POST | 停止視訊 |
| `/mobile/devices/{id}/start_webrtc` | POST | 啟動 WebRTC 視訊 |
| `/mobile/devices/{id}/photo` | POST | 遠端截圖 |

### MSLA 專用控制
| 端點 | 方法 | 說明 |
|------|------|------|
| `/mobile/devices/{id}/control/platform/home` | POST | 平台歸零 |
| `/mobile/devices/{id}/control/platform/move` | POST | 平台移動 |
| `/mobile/devices/{id}/control/heater/temperature` | POST | 加熱控制 |
| `/mobile/devices/{id}/control/case_light` | POST | 腔體燈 |
| `/mobile/devices/{id}/control/speed` | POST | 速度控制 |

## 6. 裝置能力 Feature Flags

每台機器在資料庫中有以下 flags，決定支援哪些遠端功能：

| Flag | 說明 |
|------|------|
| `withRemotePrint` | 支援遠端送印 |
| `withLive` | 支援 TUTK 視訊串流 |
| `withWebRTC` | 支援 WebRTC 視訊 |
| `withScreenshot` | 支援遠端截圖 |
| `withControl` | 支援遠端控制（平台、加熱等） |
| `withEditName` | 支援修改名稱 |

**注意**：具體哪些機型開啟哪些 flags，存在 production DB 中，code 裡看不到。

## 7. AWS 服務使用

| 服務 | 用途 |
|------|------|
| S3 | 切片檔存儲、圖片/影片、presigned URL |
| Pinpoint | Push 通知 (FCM/APNS) |
| CloudWatch | 裝置日誌 |
| Lambda | 背景清理任務 |
| SES | Email 通知 |
| NLB | MQTT broker 負載均衡 |

## 8. 認證機制

| 對象 | 方式 |
|------|------|
| App 用戶 | JWT（支援 Email/Google/Apple 登入） |
| 印表機 | RSA 簽章 → device_register → MQTT 帳密 |
| WebSocket | JWT token in handshake |
| S3 檔案 | Presigned URL（時效性） |

## 9. 技術棧

| 層級 | 技術 |
|------|------|
| 後端框架 | NestJS (TypeScript) |
| MQTT Broker | EMQX v5 |
| 資料庫 | PostgreSQL + Prisma ORM |
| 佇列 | BullMQ + Redis |
| 部署 | Kubernetes (AWS) |
| App | React Native + Expo |

## 10. DS-Online 串接可行性分析

### 可以做的
- DS-Online 後端串接 PhrozenGo 的 REST API，實現：
  - 用戶綁定印表機
  - 切片完成後上傳 S3，透過雲端送印
  - 即時監控列印進度（Socket.IO）
  - 手機網頁也能送印，不需安裝任何東西

### 需要釐清的
1. **API 存取權限**：DS-Online 能否取得 PhrozenGo backend 的 API credentials？
2. **帳號整合**：DS-Online 帳號是否沿用 PhrozenGo 帳號（spec 裡提到的）？
3. **機型支援**：哪些 MSLA 機型有 `withRemotePrint = true`？（需查 DB）
4. **檔案格式**：印表機是否接受 DS-Online 產出的 PRZ/ZIP 格式？
5. **MQTT 權限**：DS-Online 是否需要自己的 MQTT 發布權限，還是透過 PhrozenGo API 間接操作？

### 建議方案
- **短期**：透過 PhrozenGo REST API 串接（不直接碰 MQTT）
- **長期**：評估是否需要獨立的 MQTT 通道
