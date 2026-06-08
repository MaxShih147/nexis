# printer_control API 契約

## 基本資訊

| 最後確認日期 | 2026-06-02 |
| Base URL | `http://localhost:5180/api/v1` |

## OpenSpec 維護規則

任何會修改 printer control request body、SDCP command mapping、SSE events、upload limits、print-record sync、auth 或錯誤處理的 OpenSpec change，都必須同步更新本文件。

---

## 帳號管理整合 API

本節列出帳號管理整合後新增或行為變更的後端 2 endpoint。所有 endpoint 均需 `Authorization: Bearer <JWT>` header（已通過後端 2 `POST /api/v1/auth/device-token` 同步 device_token 後生效）。Response 格式採統一 `{ success, code, data }` 結構。

### 帳號管理整合 API 總覽

| Endpoint | 功能簡述 | Error code |
| --- | --- | --- |
| `POST /api/v1/auth/device-token` | 前端登入後同步後端 3 device_token 至後端 2 | `400 TOKEN_REQUIRED`、`401 DEVICE_TOKEN_MISSING`、`401 DEVICE_TOKEN_INVALID` |
| `POST /api/v1/printers/{printerId}/files` | 上傳切片檔至機台，建立列印紀錄，背景 S3 歸檔 | `400 PRINTER_ID_REQUIRED`、`400 FILE_REQUIRED`、`400 PRINTER_IP_REQUIRED`、`400 INVALID_IP_ADDRESS`、`400 MACHINE_SLUG_REQUIRED`、`400 RESIN_NAME_REQUIRED`、`400 DENTAL_MODE_REQUIRED`、`400 INVALID_FILE_TYPE`、`400 LIMIT_FILE_SIZE`、`400 BAD_REQUEST`、`401 TOKEN_MISSING`、`401 TOKEN_INVALID`、`500 FILE_UPLOAD_FAILED`、`500 RECORD_CREATE_FAILED` |
| `POST /api/v1/printers/{printerId}/print` | 依 `record_id` 開始列印 | `400 RECORD_ID_REQUIRED`、`401 TOKEN_MISSING`、`401 TOKEN_INVALID`、`404 RECORD_NOT_FOUND`、`409 RECORD_NOT_PRINTABLE`、`500 PRINTER_STATUS_FAILED`、`500 PRINT_COMMAND_FAILED`、`500 RECORD_UPDATE_FAILED`、`502 PRINTER_ACK_ERROR` |
| `POST /api/v1/printers/{printerId}/print/pause` | 暫停目前列印（不寫入後端 3 最終狀態） | `400 MAINBOARD_ID_REQUIRED`、`400 PRINTER_IP_REQUIRED`、`400 INVALID_IP_ADDRESS`、`401 TOKEN_MISSING`、`401 TOKEN_INVALID`、`500 PRINT_PAUSE_FAILED` |
| `POST /api/v1/printers/{printerId}/print/resume` | 繼續暫停中的列印（不寫入後端 3 最終狀態） | `400 MAINBOARD_ID_REQUIRED`、`400 PRINTER_IP_REQUIRED`、`400 INVALID_IP_ADDRESS`、`401 TOKEN_MISSING`、`401 TOKEN_INVALID`、`500 PRINT_RESUME_FAILED` |
| `POST /api/v1/printers/{printerId}/print/stop` | 依 `record_id` 中止列印，最終狀態更新為 `canceled` | `400 MAINBOARD_ID_REQUIRED`、`400 PRINTER_IP_REQUIRED`、`400 INVALID_IP_ADDRESS`、`401 TOKEN_MISSING`、`401 TOKEN_INVALID`、`500 PRINT_STOP_FAILED`、`500 RECORD_UPDATE_FAILED` |
| `POST /api/v1/printers/{printerId}/records/sync` | 對指定機台執行 timeout 補償（背景佇列） | `400 MAINBOARD_ID_REQUIRED`、`400 PRINTER_IP_REQUIRED`、`400 INVALID_IP_ADDRESS`、`401 TOKEN_MISSING`、`401 TOKEN_INVALID`、`500 RECORD_SYNC_FAILED` |

### `POST /api/v1/auth/device-token`

登入成功後，前端 SHALL 使用登入取得的 JWT 與後端 3 簽發的 `device_token` 呼叫此 API，讓後端 2 綁定目前使用者的後端 3 存取 credential。後端 2 SHALL 在回應前先向後端 3 驗證該 `device_token`，驗證成功才回成功。

**Request Body**

```json
{ "device_token": "12d070102b3215b2c665dbf8479a3206f59bd0602b52eaa6918dc94449b8e799" }
```

**Response 200**

```json
{ "success": true, "code": "OK", "data": {} }
```

**錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 400 | `TOKEN_REQUIRED` | 無 `Authorization` 或非 `Bearer ...` 格式 |
| 401 | `DEVICE_TOKEN_MISSING` | `device_token` 缺漏或為空字串 |
| 401 | `DEVICE_TOKEN_INVALID` | 後端 3 驗證 device token 未通過 |

---

### `POST /api/v1/printers/{printerId}/files`

上傳單一切片檔至機台。機台上傳成功後，後端 2 SHALL 呼叫後端 3 `POST /internal/print-records` 建立 `uploaded` 列印紀錄，並在 record 建立成功後立即回應前端；S3 歸檔在背景執行，不阻斷前端流程。

**Request Body（multipart/form-data）**

```
slice_file=<model.prz 或 model.ctb>
model_file=<model.stl>（選填）
mainboardIP=192.168.1.100
machine_slug=sonic_ls_plus
resin_name=Dental Ortho Model
dental_mode=ortho_model
filename=model.prz
slicing_params={...}
```

> `machine_slug`、`resin_name`、`dental_mode`、`filename`、`slicing_params` SHALL 在建立列印紀錄時一併寫入後端 3。response 不包含 S3 歸檔狀態或檔案 ID。

**Response 200**

```json
{
  "success": true,
  "code": "OK",
  "data": {
    "printerId": "printer-001",
    "printerIP": "192.168.1.100",
    "uploaded": true,
    "record_id": 42,
    "status": "uploaded"
  }
}
```

**錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 400 | `PRINTER_ID_REQUIRED` | `printerId` 缺漏 |
| 400 | `FILE_REQUIRED` | `slice_file` 缺漏 |
| 400 | `PRINTER_IP_REQUIRED` | `mainboardIP` 缺漏 |
| 400 | `INVALID_IP_ADDRESS` | `mainboardIP` 格式不符 |
| 400 | `MACHINE_SLUG_REQUIRED` | `machine_slug` 缺漏 |
| 400 | `RESIN_NAME_REQUIRED` | `resin_name` 缺漏 |
| 400 | `DENTAL_MODE_REQUIRED` | `dental_mode` 缺漏 |
| 400 | `INVALID_FILE_TYPE` | 檔案副檔名或 content type 不允許 |
| 400 | `LIMIT_FILE_SIZE` | 檔案大小超過限制 |
| 400 | `BAD_REQUEST` | `slicing_params` 欄位缺漏或格式不符（ValidationPipe） |
| 401 | `TOKEN_MISSING` | Authorization header 不存在 |
| 401 | `TOKEN_INVALID` | JWT 格式錯誤、簽章不符或已過期 |
| 500 | `FILE_UPLOAD_FAILED` | 上傳切片檔至機台失敗 |
| 500 | `RECORD_CREATE_FAILED` | 機台上傳成功，但建立後端 3 列印紀錄失敗 |

---

### `POST /api/v1/printers/{printerId}/print`

依既有 `record_id` 開始列印。後端 2 SHALL 向後端 3 查詢該 record 的 `mainboard_id`、`mainboard_ip`、`filename`，再以 `startLayer = 0` 對機台送出開始列印指令。機台接受後，後端 2 監聽 SDCP WebSocket，機台開始列印後將紀錄更新為 `printing`。

**Request Body**

```json
{ "record_id": 42 }
```

**Response 200**

```json
{ "success": true, "code": "OK", "data": {} }
```

**錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 400 | `RECORD_ID_REQUIRED` | `record_id` 缺漏 |
| 401 | `TOKEN_MISSING` | Authorization header 不存在 |
| 401 | `TOKEN_INVALID` | JWT 格式錯誤、簽章不符或已過期 |
| 404 | `RECORD_NOT_FOUND` | 紀錄不存在或不屬於目前使用者 |
| 409 | `RECORD_NOT_PRINTABLE` | 紀錄狀態不可開始列印 |
| 500 | `PRINTER_STATUS_FAILED` | 查詢機台狀態失敗 |
| 500 | `PRINT_COMMAND_FAILED` | 開始列印指令送出失敗 |
| 500 | `RECORD_UPDATE_FAILED` | 機台進入列印後回寫後端 3 失敗 |
| 502 | `PRINTER_ACK_ERROR` | 機台回應拒絕或格式不符 |

---

### `POST /api/v1/printers/{printerId}/print/pause`

暫停目前列印。此 API 通常只更新機台與 UI 狀態，不寫入後端 3 的最終列印狀態。

**Request Body**

```json
{ "mainboardID": "000000000001d354", "mainboardIP": "192.168.1.100" }
```

**Response 200**

```json
{ "success": true, "code": "OK", "data": {} }
```

**錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 400 | `MAINBOARD_ID_REQUIRED` | `mainboardID` 缺漏 |
| 400 | `PRINTER_IP_REQUIRED` | `mainboardIP` 缺漏 |
| 400 | `INVALID_IP_ADDRESS` | `mainboardIP` 格式不符 |
| 401 | `TOKEN_MISSING` | Authorization header 不存在 |
| 401 | `TOKEN_INVALID` | JWT 格式錯誤、簽章不符或已過期 |
| 500 | `PRINT_PAUSE_FAILED` | 暫停列印指令送出失敗 |

---

### `POST /api/v1/printers/{printerId}/print/resume`

繼續暫停中的列印。此 API 通常只更新機台與 UI 狀態，不寫入後端 3 的最終列印狀態。

**Request Body**

```json
{ "mainboardID": "000000000001d354", "mainboardIP": "192.168.1.100" }
```

**Response 200**

```json
{ "success": true, "code": "OK", "data": {} }
```

**錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 400 | `MAINBOARD_ID_REQUIRED` | `mainboardID` 缺漏 |
| 400 | `PRINTER_IP_REQUIRED` | `mainboardIP` 缺漏 |
| 400 | `INVALID_IP_ADDRESS` | `mainboardIP` 格式不符 |
| 401 | `TOKEN_MISSING` | Authorization header 不存在 |
| 401 | `TOKEN_INVALID` | JWT 格式錯誤、簽章不符或已過期 |
| 500 | `PRINT_RESUME_FAILED` | 繼續列印指令送出失敗 |

---

### `POST /api/v1/printers/{printerId}/print/stop`

中止目前列印。後端 2 SHALL 依 `record_id` 向後端 3 查詢 `mainboard_ip`，對機台送出終止列印指令；機台停止列印後，再由後端 2 透過內部 API 將既有列印紀錄更新為 `canceled`。

**Request Body**

```json
{ "record_id": 42 }
```

**Response 200**

```json
{ "success": true, "code": "OK", "data": {} }
```

**錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 400 | `MAINBOARD_ID_REQUIRED` | record 查得的 `mainboard_id` 缺漏 |
| 400 | `PRINTER_IP_REQUIRED` | record 查得的 `mainboard_ip` 缺漏 |
| 400 | `INVALID_IP_ADDRESS` | `mainboard_ip` 格式不符 |
| 401 | `TOKEN_MISSING` | Authorization header 不存在 |
| 401 | `TOKEN_INVALID` | JWT 格式錯誤、簽章不符或已過期 |
| 500 | `PRINT_STOP_FAILED` | 終止列印指令送出失敗 |
| 500 | `RECORD_UPDATE_FAILED` | 機台停止後回寫後端 3 失敗 |

---

### `POST /api/v1/printers/{printerId}/records/sync`

要求後端 2 對指定機台執行 timeout 補償。後端 2 SHALL 將補償工作排入背景佇列後立即回應，不讓前端等待 SDCP 歷史任務查詢完成。

**Request Body**

```json
{ "mainboardID": "000000000001d354", "mainboardIP": "192.168.1.100" }
```

**Response 202**

```json
{
  "success": true,
  "code": "OK",
  "data": { "mainboardID": "000000000001d354", "queued": true }
}
```

**錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 400 | `MAINBOARD_ID_REQUIRED` | `mainboardID` 缺漏 |
| 400 | `PRINTER_IP_REQUIRED` | `mainboardIP` 缺漏 |
| 400 | `INVALID_IP_ADDRESS` | `mainboardIP` 格式不符 |
| 401 | `TOKEN_MISSING` | Authorization header 不存在 |
| 401 | `TOKEN_INVALID` | JWT 格式錯誤、簽章不符或已過期 |
| 500 | `RECORD_SYNC_FAILED` | timeout 補償工作排入或執行失敗 |

---

## Headers 與身份驗證

| Header | 必填 | 適用範圍 | 備註 |
| --- | --- | --- | --- |
| `Authorization` | 否 | 目前所有 endpoints | 現行後端不驗證 token。未來帳號整合後，前端呼叫應加入 `Authorization: Bearer <token>`，後端對後端呼叫應使用 service credential。 |
| `Content-Type: application/json` | 是 | JSON endpoints | Print/status/subscription commands 需要。 |
| `Content-Type: multipart/form-data` | 是 | 檔案上傳 endpoints | 單檔使用 `file`，批次使用 `files`。 |

## 共用 Response 格式

已實作的 JSON endpoints 通常使用：

```json
{
  "success": true,
  "message": "Message",
  "data": {},
  "timestamp": "2026-04-15T00:00:00.000Z"
}
```

`formatResponse().sendError()` 產生的錯誤格式：

```json
{
  "success": false,
  "message": "Error message",
  "error": {},
  "timestamp": "2026-04-15T00:00:00.000Z"
}
```

部分 placeholder endpoints 目前仍透過 `res.send(...)` 回傳 plain text。

## 現行錯誤格式

目前只有以下情境會明確輸出 error code：

- Rate limit：`{ error, code: "RATE_LIMIT_EXCEEDED" }`。
- Upload middleware：`{ success: false, message, error: { code, field? }, timestamp }`。

多數 controller errors 尚未輸出穩定的 `code` 欄位。下方文件化 codes 是前端 mapping 名稱，也是未來後端應收斂的目標。

## 資料模型

### Printer Discovery Item

| 欄位 | 型別 | 備註 |
| --- | --- | --- |
| `mainboardIP` | string | 回覆 UDP discovery 的 IP address。 |
| `info` | object | 從 printer UDP response 解析出的 `Data` object；shape 取決於機台 firmware。 |

### Printer Command Body

| 欄位 | 型別 | 必填 | 備註 |
| --- | --- | --- | --- |
| `mainboardID` | string | 是 | SDCP mainboard id。 |
| `mainboardIP` | string | 是 | Printer IP address。 |

### Normalized Status

| 欄位 | 型別 | 備註 |
| --- | --- | --- |
| `currentStatus` | string | `Idle`, `Printing`, `File Transferring`, `Exposure Testing`, `Device Testing`。 |
| `printStatus` | string | `Idle`, `Homing`, `Dropping`, `Exposuring`, `Lifting`, `Pausing`, `Paused`, `Stopping`, `Stopped`, `Complete`, `File Checking`。 |
| `filename` | string | 目前列印檔名。 |
| `taskId` | string or number | SDCP task id。 |
| `currentLayer` | number or null | 目前 layer。 |
| `totalLayer` | number or null | 總 layer 數。 |
| `mainboardIP` | string | Printer IP。 |
| `mainboardID` | string | Mainboard id。 |
| `timestamp` | string | ISO timestamp。 |
| `success` | boolean | 離線或 parse error 時為 `false`。 |

### Upload Limits

| 欄位 | 值 |
| --- | --- |
| 允許副檔名 | `.prz`, `.ctb` |
| 單檔上傳欄位 | `file` |
| 批次上傳欄位 | `files` |
| 批次最大數量 | 5 files |
| 單檔大小上限 | 100 MB |
| 機台上傳目標 | `http://{mainboardIP}:3030/uploadFile/upload` |
| Chunk size | 1 MB |

### SDCP Command Mapping

| 後端動作 | SDCP command | 備註 |
| --- | --- | --- |
| 取得狀態 | `0` | Status request。 |
| 開始列印 | `128` | 傳送 `{ Filename, StartLayer }`。 |
| 暫停列印 | `129` | Empty data。 |
| 停止列印 | `130` | Empty data。 |
| 繼續列印 | `131` | Empty data。 |

### SDCP ACK Mapping

| ACK | 意義 |
| --- | --- |
| `0` | OK |
| `1` | Busy |
| `2` | File Not Found |
| `3` | MD5 Verification Failed |
| `4` | File Read Failed |
| `5` | Resolution Mismatch |
| `6` | Unrecognized File Format |
| `7` | Machine Model Mismatch |

## Endpoint 清單

| Method + Endpoint | 功能簡介 | Params | Request Body | Response Body | Errors | Headers |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /api/v1/health` | Liveness 與 process health。 | None | None | `{ success, message, data: { status, version, name, uptimeSeconds, timestamp, pid, memory }, timestamp }` | `429 RATE_LIMIT_EXCEEDED`, `500 INTERNAL_SERVER_ERROR` | None |
| `GET /api/v1/ready` | Readiness probe。 | None | None | `{ success, message, data: { ready: true }, timestamp }` | `429 RATE_LIMIT_EXCEEDED`, `500 INTERNAL_SERVER_ERROR` | None |
| `GET /api/v1/printers/discover` | 透過 UDP broadcast/unicast 探索機台。 | None | None | `{ success, message, data: { printers: [{ info, mainboardIP }] }, timestamp }` | `429 RATE_LIMIT_EXCEEDED`, `500 PRINTER_DISCOVERY_FAILED` | None |
| `POST /api/v1/printers/resolve` | 以指定 IP 執行 UDP unicast，取得機台身份（`mainboardID`、名稱、型號、韌體）。不建立 WebSocket 連線。 | None | `{ mainboardIP: string }` | `{ success, code, data: { mainboardIP, mainboardID, name, model, firmware } }` | `400 MAINBOARD_IP_REQUIRED`, `400 INVALID_IP_ADDRESS`, `404 PRINTER_NOT_FOUND`, `502 PRINTER_DISCOVERY_INVALID_RESPONSE`, `502 MAINBOARD_ID_MISSING`, `500 PRINTER_RESOLVE_FAILED` | JSON |
| `GET /api/v1/printers` | 取得已知機台列表的 placeholder。 | None | None | Plain text `"Get all printers"` | `429 RATE_LIMIT_EXCEEDED` | None |
| `GET /api/v1/printers/{printerId}` | 取得單一已知機台的 placeholder。 | path `printerId` | None | Plain text `"Get printer"` | `429 RATE_LIMIT_EXCEEDED` | None |
| `POST /api/v1/printers/{printerId}/connect` | 開啟 WebSocket 並要求狀態，以連線到機台。 | path `printerId` | `{ mainboardIP: string, mainboardID: string }` | `{ success, message, data: NormalizedStatus, timestamp }` | `400 MAINBOARD_IP_REQUIRED`, `400 MAINBOARD_ID_REQUIRED`, `500 PRINTER_CONNECT_FAILED`, `429 RATE_LIMIT_EXCEEDED` | JSON |
| `POST /api/v1/printers/{printerId}/disconnect` | 斷線 placeholder。 | path `printerId` | 現行未使用 | Plain text `"Disconnect from printer"` | `429 RATE_LIMIT_EXCEEDED` | None |
| `PATCH /api/v1/printers/{printerId}/settings` | 更新機台設定 placeholder。 | path `printerId` | 尚未實作 | Plain text `"Update printer settings"` | `429 RATE_LIMIT_EXCEEDED` | 實作後使用 JSON |
| `GET /api/v1/printers/{printerId}/status` | 取得目前機台狀態。現行實作會在 GET request 讀 JSON body。 | path `printerId` | `{ mainboardIP: string, mainboardID: string }` | `{ success, message, data: NormalizedStatus, timestamp }` | `400 MAINBOARD_ID_REQUIRED`, `400 MAINBOARD_IP_REQUIRED`, `500 PRINTER_STATUS_FAILED`, `429 RATE_LIMIT_EXCEEDED` | GET 搭配 JSON body |
| `GET /api/v1/printers/{printerId}/status/history` | 狀態歷史 placeholder。 | path `printerId` | None | Plain text `"Get status history"` | `429 RATE_LIMIT_EXCEEDED` | None |
| `POST /api/v1/printers/status/subscribe` | 為一台或多台機台開啟 SSE status stream。 | None | `{ machines: [{ mainboardIP: string, mainboardID: string }] }` | SSE events：`connected`, `status-update`, `subscription-updated` | `400 MACHINES_REQUIRED`, `400 MACHINE_ID_OR_IP_REQUIRED`, `500 INTERNAL_SERVER_ERROR`, `429 RATE_LIMIT_EXCEEDED` | Request JSON，response `text/event-stream` |
| `POST /api/v1/printers/status/unsubscribe` | 停止 SSE subscription。 | None | `{ clientId: string }` | `{ success, message, data?: undefined, timestamp }` | `400 CLIENT_ID_REQUIRED`, `404 CLIENT_ID_NOT_FOUND`, `500 INTERNAL_SERVER_ERROR`, `429 RATE_LIMIT_EXCEEDED` | JSON |
| `POST /api/v1/printers/status/machines/add` | 將機台加入既有 SSE subscription。 | None | `{ clientId: string, machines: [{ mainboardIP, mainboardID }] }` | `{ success, message, data?: undefined, timestamp }` 與 SSE `subscription-updated` | `400 CLIENT_ID_REQUIRED`, `400 MACHINES_REQUIRED`, `400 MACHINE_ID_OR_IP_REQUIRED`, `404 CLIENT_ID_NOT_FOUND`, `500 INTERNAL_SERVER_ERROR` | JSON |
| `POST /api/v1/printers/status/machines/remove` | 從既有 SSE subscription 移除機台。 | None | `{ clientId: string, machines: [{ mainboardIP }] }` | `{ success, message, data?: undefined, timestamp }` 與 SSE `subscription-updated` | `400 CLIENT_ID_REQUIRED`, `400 MACHINES_REQUIRED`, `400 MACHINE_IP_REQUIRED`, `404 CLIENT_ID_NOT_FOUND`, `500 INTERNAL_SERVER_ERROR` | JSON |
| `GET /api/v1/printers/{printerId}/files` | 列出機台檔案 placeholder。 | path `printerId` | None | Plain text `"List files from printer"` | `429 RATE_LIMIT_EXCEEDED` | None |
| `POST /api/v1/printers/{printerId}/files` | 上傳單一 `.prz` 或 `.ctb` 到機台。 | path `printerId`; multipart field `file`; form field `mainboardIP` | `multipart/form-data` | `{ success, message, data: { printerId, printerIP, uploaded, results: [{ filename, success }] }, timestamp }` | `400 PRINTER_ID_REQUIRED`, `400 FILE_REQUIRED`, `400 FILE_PATH_REQUIRED`, `400 MAINBOARD_IP_REQUIRED`, `400 INVALID_IP_ADDRESS`, `400 INVALID_FILE_TYPE`, `400 LIMIT_FILE_SIZE`, `400 LIMIT_UNEXPECTED_FILE`, `500 PRINTER_UPLOAD_FAILED`, `429 RATE_LIMIT_EXCEEDED` | Multipart |
| `POST /api/v1/printers/{printerId}/files/batch` | 上傳最多五個 `.prz`/`.ctb` 到機台。 | path `printerId`; multipart field `files`; form field `mainboardIP` | `multipart/form-data` | 成功 `200`；部分成功 `207`，包含 `{ successCount, failureCount, results }` | 單檔上傳錯誤加上 `400 LIMIT_FILE_COUNT` | Multipart |
| `DELETE /api/v1/printers/{printerId}/files/{filename}` | 刪除機台檔案 placeholder。 | path `printerId`, `filename` | None | Plain text `"Delete file from printer"` | `429 RATE_LIMIT_EXCEEDED` | None |
| `GET /api/v1/printers/{printerId}/files/{filename}` | 檔案資訊 placeholder。 | path `printerId`, `filename` | None | Plain text `"Get file information"` | `429 RATE_LIMIT_EXCEEDED` | None |
| `POST /api/v1/printers/{printerId}/print` | 開始列印；若同檔名已暫停則改為 resume。 | path `printerId` | `{ mainboardID: string, mainboardIP: string, filename: string, startLayer?: number }` | `{ success, message, data: { success, data?, meta?, machineStatus?, printStatus? }, timestamp }` | `400 MAINBOARD_ID_REQUIRED`, `400 MAINBOARD_IP_REQUIRED`, `400 FILENAME_REQUIRED`, `500 PRINT_START_FAILED`, `429 RATE_LIMIT_EXCEEDED` | JSON |
| `POST /api/v1/printers/{printerId}/print/pause` | 暫停目前列印。 | path `printerId` | `{ mainboardID: string, mainboardIP: string }` | `{ success, message, data: { success, data?, meta?, machineStatus?, printStatus? }, timestamp }` | `400 MAINBOARD_ID_REQUIRED`, `400 MAINBOARD_IP_REQUIRED`, `500 PRINT_PAUSE_FAILED`, `429 RATE_LIMIT_EXCEEDED` | JSON |
| `POST /api/v1/printers/{printerId}/print/resume` | 繼續暫停中的列印。 | path `printerId` | `{ mainboardID: string, mainboardIP: string }` | `{ success, message, data: { success, data?, meta?, machineStatus?, printStatus? }, timestamp }` | `400 MAINBOARD_ID_REQUIRED`, `400 MAINBOARD_IP_REQUIRED`, `500 PRINT_RESUME_FAILED`, `429 RATE_LIMIT_EXCEEDED` | JSON |
| `POST /api/v1/printers/{printerId}/print/stop` | 停止目前列印。 | path `printerId` | `{ mainboardID: string, mainboardIP: string }` | `{ success, message, data: { success, data?, meta?, machineStatus?, printStatus? }, timestamp }` | `400 MAINBOARD_ID_REQUIRED`, `400 MAINBOARD_IP_REQUIRED`, `500 PRINT_STOP_FAILED`, `429 RATE_LIMIT_EXCEEDED` | JSON |
| `GET /api/v1/printers/{printerId}/print/current` | 目前列印 placeholder。 | path `printerId` | None | Plain text `"get current print"` | `429 RATE_LIMIT_EXCEEDED` | None |
| `GET /api/v1/printers/{printerId}/print/history` | 列印歷史 placeholder。 | path `printerId` | None | Plain text `"get print history"` | `429 RATE_LIMIT_EXCEEDED` | None |
| `POST /api/v1/printers/{printerId}/control/temperature` | 溫度控制 placeholder。 | path `printerId` | 尚未實作 | Plain text `"Temperature control"` | `429 RATE_LIMIT_EXCEEDED` | 實作後使用 JSON |
| `POST /api/v1/printers/{printerId}/control/fans` | 風扇控制 placeholder。 | path `printerId` | 尚未實作 | Plain text `"Fan control"` | `429 RATE_LIMIT_EXCEEDED` | 實作後使用 JSON |
| `POST /api/v1/printers/{printerId}/control/lighting` | 燈光控制 placeholder。 | path `printerId` | 尚未實作 | Plain text `"Light control"` | `429 RATE_LIMIT_EXCEEDED` | 實作後使用 JSON |
| `POST /api/v1/printers/{printerId}/control/move` | 移動控制 placeholder。 | path `printerId` | 尚未實作 | Plain text `"Movement control"` | `429 RATE_LIMIT_EXCEEDED` | 實作後使用 JSON |
| `POST /api/v1/printers/{printerId}/control/home` | 歸零 placeholder。 | path `printerId` | 尚未實作 | Plain text `"Home axis"` | `429 RATE_LIMIT_EXCEEDED` | 實作後使用 JSON |
| `GET /api/v1/printers/{printerId}/video/stream` | 影片串流 URL placeholder。 | path `printerId` | None | Plain text `"Get video stream URL"` | `429 RATE_LIMIT_EXCEEDED` | None |
| `POST /api/v1/printers/{printerId}/video/camera` | 相機控制 placeholder。 | path `printerId` | 尚未實作 | Plain text `"Enable/disable camera"` | `429 RATE_LIMIT_EXCEEDED` | 實作後使用 JSON |

## SSE Events

| Event | Data |
| --- | --- |
| `connected` | `{ clientId, machines: number }` |
| `status-update` | `{ timestamp, machines: [NormalizedStatus] }` |
| `subscription-updated` | `{ timestamp, added: string[], removed: string[], totalMachines: number }` |

## Error Code 登錄表

| 文件化 code | 現行是否輸出 code 欄位 | HTTP status | 意義 |
| --- | --- | --- | --- |
| `RATE_LIMIT_EXCEEDED` | 是，top-level `code` | 429 | 同一 IP 15 分鐘內超過 1000 requests。 |
| `INVALID_FILE_TYPE` | 是，`error.code` | 400 | 上傳副檔名不是 `.prz` 或 `.ctb`。 |
| `LIMIT_FILE_SIZE` | 是，`error.code` | 400 | 上傳檔案超過 100 MB。 |
| `LIMIT_FILE_COUNT` | 是，`error.code` | 400 | 批次上傳超過 5 files。 |
| `LIMIT_UNEXPECTED_FILE` | 是，`error.code` | 400 | Multipart field name 不符合預期。 |
| `PRINTER_DISCOVERY_FAILED` | 否 | 500 | UDP discovery 失敗。 |
| `PRINTER_NOT_FOUND` | 是，`code` | 404 | `POST /printers/resolve`：UDP unicast 在 timeout 內無任何回覆。 |
| `PRINTER_DISCOVERY_INVALID_RESPONSE` | 是，`code` | 502 | `POST /printers/resolve`：收到 UDP 回覆但 info 為 null（無法解析）。 |
| `MAINBOARD_ID_MISSING` | 是，`code` | 502 | `POST /printers/resolve`：info 存在但缺少 `MainboardID` 欄位。 |
| `PRINTER_RESOLVE_FAILED` | 是，`code` | 500 | `POST /printers/resolve`：其他未預期錯誤。 |
| `MAINBOARD_IP_REQUIRED` | 否 | 400 | 缺少 `mainboardIP`。 |
| `MAINBOARD_ID_REQUIRED` | 否 | 400 | 缺少 `mainboardID`。 |
| `PRINTER_CONNECT_FAILED` | 否 | 500 | WebSocket 連線或 status request 失敗。 |
| `PRINTER_STATUS_FAILED` | 否 | 500 | 狀態查詢失敗。 |
| `MACHINES_REQUIRED` | 否 | 400 | SSE machines array 缺失或為空。 |
| `MACHINE_ID_OR_IP_REQUIRED` | 否 | 400 | SSE machine 缺少 id 或 IP。 |
| `CLIENT_ID_REQUIRED` | 否 | 400 | 缺少 `clientId`。 |
| `CLIENT_ID_NOT_FOUND` | 否 | 404 | 找不到 SSE subscription id。 |
| `MACHINE_IP_REQUIRED` | 否 | 400 | Machine removal entry 缺少 `mainboardIP`。 |
| `PRINTER_ID_REQUIRED` | 否 | 400 | 缺少 `printerId` path param。 |
| `FILE_REQUIRED` | 否 | 400 | Upload request 沒有檔案。 |
| `FILE_PATH_REQUIRED` | 否 | 400 | 儲存後的 upload path 缺失。 |
| `INVALID_IP_ADDRESS` | 否 | 400 | `mainboardIP` 不符合 IPv4 格式。 |
| `PRINTER_UPLOAD_FAILED` | 否 | 500 | 上傳檔案到機台失敗。 |
| `FILENAME_REQUIRED` | 否 | 400 | 開始列印缺少 filename。 |
| `PRINT_START_FAILED` | 否 | 500 | Start print command 失敗。 |
| `PRINT_PAUSE_FAILED` | 否 | 500 | Pause command 失敗。 |
| `PRINT_RESUME_FAILED` | 否 | 500 | Resume command 失敗。 |
| `PRINT_STOP_FAILED` | 否 | 500 | Stop command 失敗。 |
| `INTERNAL_SERVER_ERROR` | 否 | 500 | 未處理或一般 server error。 |

## 已知缺口

- 多數 routes 仍是 placeholder，回傳 plain text 而非結構化 JSON。
- `GET /api/v1/printers/{printerId}/status` 目前預期 GET request body；前端以明確 Axios request 繞過這個限制。
- Controller errors 通常序列化 raw `Error` object，對 client 不夠穩定。
- 尚未 enforce auth。
- 後端 2 尚未呼叫後端 3 internal print-record APIs。
