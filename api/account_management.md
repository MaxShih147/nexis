# account_management API 契約

## 基本資訊

| 欄位 | 值 |
| --- | --- |
| 後端 | account_management（後端 3） |
| 職責 | 身份驗證、使用者資料、列印紀錄、檔案歸檔、internal record sync |
| Base URL | `https://webslicer.phrozen3d.info` |
| 最後確認日期 | 2026-05-13 |

## 服務邊界

| 服務 | 職責 | 前端是否直接呼叫 |
|------|------|------------------|
| 前端 | UI、JWT 保存、切片參數組裝、使用者操作入口 | — |
| 後端 2：機台連線與控制服務 | SDCP 機台探索、WebSocket 連線、檔案上傳、開始/暫停/繼續/停止列印、機台狀態監聽、歷史任務補查 | 是 |
| 後端 3：帳號與資料服務（本文件） | `/v1/auth/*`、`/v1/user/*`、DB CRUD、檔案 TTL 清除 | 是 |

**互動原則**

- 前端 SHALL 直接呼叫後端 3 處理註冊、登入、列印紀錄查詢與模型檔下載。
- 後端 2 SHALL 作為機台狀態的唯一寫入者：列印開始、完成、失敗、停止後的狀態回填，均由後端 2 呼叫後端 3 內部 API 更新 DB。
- 後端 3 SHALL 作為列印紀錄與帳號資料的唯一持久化來源；後端 2 不保存永久資料，只保存連線狀態與短期任務映射。

## 共用規範

### 時區

所有 DateTime 統一使用 UTC，格式為 ISO 8601（例：`"2026-04-13T02:00:00.000Z"`）。前端負責依用戶時區轉換顯示，後端不處理時區轉換。

### Response 格式

```json
{
  "success": true,
  "code": "OK",
  "data": {}
}
```

---

## API 總覽

| 使用對象 | Endpoint | 功能簡述 | Error code |
|----------|----------|----------|------------|
| — | `GET /health` | 服務狀態確認 | `503 SERVICE_UNAVAILABLE` |
| 前端 | `POST /v1/auth/register` | 透過 Phrozen Portal 註冊帳號 | `202 REGISTER_PENDING_VERIFICATION`、`422 EMAIL_FORMAT_INVALID`、`422 PASSWORD_FORMAT_INVALID`、`429 RATE_LIMIT_EXCEEDED` |
| 前端 | `POST /v1/auth/login` | 透過 Portal 驗證帳密，簽發 JWT | `401 CREDENTIALS_INVALID`、`403 ACCOUNT_NOT_VERIFIED`、`403 ACCOUNT_INACTIVE`、`403 SOCIAL_LOGIN_ONLY`、`429 RATE_LIMIT_EXCEEDED` |
| 前端 | `POST /v1/auth/resend-verification` | 重新寄送 Portal 驗證信 | `400 BAD_REQUEST`、`429 RATE_LIMIT_EXCEEDED` |
| 前端 | `POST /v1/auth/forgot-password` | Portal 寄送重設密碼信 | `400 BAD_REQUEST`、`429 RATE_LIMIT_EXCEEDED` |
| 前端 | `GET /v1/auth/oauth/:provider` | 取得 Google/Apple OAuth 授權 URL | `400 INVALID_OAUTH_PROVIDER`、`500 INTERNAL_SERVER_ERROR` |
| 前端 | `POST /v1/auth/oauth/callback` | OAuth callback，簽發 JWT | `400 INVALID_OAUTH_STATE`、`502 OAUTH_FAILED` |
| 前端（需 JWT） | `POST /v1/auth/device-token` | 簽發 device token，供後端 2 使用 | `401 TOKEN_MISSING`、`401 TOKEN_INVALID_OR_EXPIRED` |
| 前端（需 JWT） | `GET /v1/user/print-records` | 查詢使用者列印紀錄列表 | `401 TOKEN_MISSING`、`401 TOKEN_INVALID_OR_EXPIRED`、`422 INVALID_DATE_RANGE`、`400 BAD_REQUEST`、`422 INVALID_STATUS_VALUE`、`422 INVALID_PAGE_SIZE`、`422 INVALID_PAGE` |
| 前端（需 JWT） | `GET /v1/user/print-records/{record_id}` | 取得單筆列印紀錄詳情 | `401 TOKEN_MISSING`、`401 TOKEN_INVALID_OR_EXPIRED`、`404 RECORD_NOT_FOUND` |
| 前端（需 JWT） | `GET /v1/user/print-records/{record_id}/model-file` | 取得原始模型檔 S3 presigned URL | `401 TOKEN_MISSING`、`401 TOKEN_INVALID_OR_EXPIRED`、`404 RECORD_NOT_FOUND`、`404 FILE_NOT_FOUND`、`410 FILE_EXPIRED` |
| 後端 2 | `GET /internal/ping` | 驗證 device token 是否有效 | `401 DEVICE_TOKEN_MISSING`、`401 DEVICE_TOKEN_INVALID` |
| 後端 2 | `POST /internal/print-records` | 建立 uploaded 列印紀錄 | `401 DEVICE_TOKEN_MISSING`、`401 DEVICE_TOKEN_INVALID`、`400 BAD_REQUEST` |
| 後端 2 | `GET /internal/print-records/{record_id}` | 查詢列印紀錄機台資訊 | `401 DEVICE_TOKEN_MISSING`、`401 DEVICE_TOKEN_INVALID`、`404 RECORD_NOT_FOUND` |
| 後端 2 | `PATCH /internal/print-records/{record_id}` | 補寫檔案引用與狀態 | `401 DEVICE_TOKEN_MISSING`、`401 DEVICE_TOKEN_INVALID`、`404 RECORD_NOT_FOUND`、`400 BAD_REQUEST`、`422 IMMUTABLE_FIELD`、`422 INVALID_STATUS_TRANSITION`、`422 TASK_ID_ALREADY_EXISTS` |
| 後端 2 | `GET /internal/print-records/timeouts` | 取得需補償的 timeout 紀錄 | `401 DEVICE_TOKEN_MISSING`、`401 DEVICE_TOKEN_INVALID`、`400 BAD_REQUEST` |
| 後端 2 | `POST /internal/print-records/{record_id}/reconcile-attempt` | 記錄 timeout 補償嘗試 | `401 DEVICE_TOKEN_MISSING`、`401 DEVICE_TOKEN_INVALID`、`404 RECORD_NOT_FOUND`、`400 BAD_REQUEST` |
| 後端 2 | `POST /internal/files/upload-targets` | 建立 S3 upload target | `401 DEVICE_TOKEN_MISSING`、`401 DEVICE_TOKEN_INVALID`、`404 RECORD_NOT_FOUND`、`422 INVALID_FILE_ROLE`、`422 INVALID_FILE_TYPE`、`400 BAD_REQUEST` |
| 後端 2 | `POST /internal/files/{file_id}/confirm` | 確認 S3 上傳完成 | `401 DEVICE_TOKEN_MISSING`、`401 DEVICE_TOKEN_INVALID`、`404 FILE_NOT_FOUND`、`422 INVALID_DATETIME_FORMAT`、`422 INVALID_NUMERIC_FIELD` |

---

## Health Check

### `GET /health`

**Response 200**

```json
{ "success": true, "code": "OK", "data": { "status": "ok" } }
```

**Response 503**

```json
{ "success": false, "code": "SERVICE_UNAVAILABLE", "data": null }
```

---

## `/v1/auth` — 身份驗證（不需 JWT）

帳號系統由 Phrozen Portal 統一管理。後端 3 作為中介層呼叫 Portal API，不自行管理密碼或 email verification token；登入成功後由後端 3 簽發 Web Slicer 專屬 JWT。

### `POST /v1/auth/register`

透過 Phrozen Portal 建立帳號，Portal 負責寄送驗證信。若 email 已存在，SHALL 回傳與成功相同的 response，避免 account enumeration。

**Portal 密碼規則**

1. 最少 8 個字元（無上限）
2. 至少一個大寫英文字母（A–Z）
3. 至少一個小寫英文字母（a–z）
4. 至少一個數字（0–9）
5. 至少一個特殊字元，且只允許這 7 個：`@ $ ! % * ? &`
6. 密碼只能由以上字元組成，其他符號（# ^ ( ) - _ . , 等）一律不允許

**Request Body**

```json
{
  "email": "user@example.com",
  "password": "Abc12345",
  "firstName": "小明",
  "lastName": "王"
}
```

**Response 202**

```json
{ "success": true, "code": "REGISTER_PENDING_VERIFICATION", "data": null }
```

**錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 202 | `REGISTER_PENDING_VERIFICATION` | 成功；email 已存在時也回相同 code |
| 422 | `EMAIL_FORMAT_INVALID` | email 格式不符 |
| 422 | `PASSWORD_FORMAT_INVALID` | 密碼格式不符 Portal 規則 |
| 429 | `RATE_LIMIT_EXCEEDED` | 短時間內大量嘗試 |

---

### `POST /v1/auth/login`

透過 Phrozen Portal 驗證帳密，成功後由後端 3 簽發 Web Slicer 專屬 JWT。

**Request Body**

```json
{ "email": "user@example.com", "password": "Abc12345" }
```

**Response 200**

```json
{
  "success": true,
  "code": "OK",
  "data": {
    "access_token": "eyJhbGci...",
    "token_type": "bearer",
    "expires_at": "2026-04-13T02:00:00.000Z"
  }
}
```

**錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 401 | `CREDENTIALS_INVALID` | email 或密碼錯誤，不區分原因 |
| 403 | `ACCOUNT_NOT_VERIFIED` | 帳號尚未完成 email 驗證 |
| 403 | `ACCOUNT_INACTIVE` | 帳號已被停用 |
| 403 | `SOCIAL_LOGIN_ONLY` | 帳號只能使用 social login |
| 429 | `RATE_LIMIT_EXCEEDED` | 短時間內大量嘗試 |

---

### `POST /v1/auth/resend-verification`

重新寄送 Portal 驗證信。無論 email 是否存在，SHALL 使用相同成功 response，避免 account enumeration。Service 層吃掉所有 Portal 錯誤，永遠回 202。

**Request Body**

```json
{ "email": "user@example.com" }
```

**Response 202**

```json
{ "success": true, "code": "VERIFICATION_EMAIL_SENT", "data": null }
```

**錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | email 格式不符（ValidationPipe） |
| 429 | `RATE_LIMIT_EXCEEDED` | 短時間內大量嘗試 |

---

### `POST /v1/auth/forgot-password`

由 Portal 寄送重設密碼信。無論 email 是否存在，SHALL 使用相同成功 response，避免 account enumeration。

**Request Body**

```json
{ "email": "user@example.com" }
```

**Response 202**

```json
{ "success": true, "code": "FORGOT_PASSWORD_EMAIL_SENT", "data": null }
```

**錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | email 格式不符（ValidationPipe） |
| 429 | `RATE_LIMIT_EXCEEDED` | 短時間內大量嘗試 |

---

### `GET /v1/auth/oauth/:provider`

取得指定 provider（`google` / `apple`）的 OAuth 授權 URL，前端將用戶導向此 URL 完成授權。

**Path Params**

| 參數 | 說明 |
| --- | --- |
| `provider` | `google` 或 `apple` |

**Query Params**

| 參數 | 必填 | 說明 |
| --- | --- | --- |
| `redirect_url` | 是 | OAuth 完成後 Portal 導回的 URL（需為合法 URL） |

**Response 200**

```json
{
  "success": true,
  "code": "OK",
  "data": {
    "oauth_url": "https://accounts.google.com/o/oauth2/v2/auth?...",
    "client_state": "eyJhbGci..."
  }
}
```

> `client_state` 是後端 3 產生的 JWT，有效期 5 分鐘，callback 時回傳做 CSRF 防護。

**錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 400 | `INVALID_OAUTH_PROVIDER` | `provider` 不是 `google` 或 `apple` |
| 500 | `INTERNAL_SERVER_ERROR` | Portal 回應缺少 redirect URL |

---

### `POST /v1/auth/oauth/callback`

OAuth 授權完成後，前端將 Google/Apple 回傳的 code 連同 redirect_url、client_state 送至此 endpoint，後端 3 透過 Portal 兌換 token，成功後簽發 Web Slicer JWT。

**Request Body**

```json
{
  "code": "4/0AX4XfWh...",
  "redirect_url": "https://your-frontend/oauth/callback",
  "client_state": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response 200**

```json
{
  "success": true,
  "code": "OK",
  "data": {
    "access_token": "eyJhbGci...",
    "token_type": "bearer",
    "expires_at": "2026-04-13T02:00:00.000Z"
  }
}
```

**錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 400 | `INVALID_OAUTH_STATE` | `client_state` 不存在或已過期（5 分鐘內有效） |
| 502 | `OAUTH_FAILED` | Portal 驗證 code 失敗（code 過期或已使用） |

---

### `POST /v1/auth/device-token`（需 JWT）

專門為桌面軟體（後端 2）簽發 device token。每次呼叫都會覆寫舊 token（一個使用者只有一組 device token）。前端在登入成功後 SHALL 將此 `device_token` 傳給後端 2 `POST /api/v1/auth/device-token`。

**Headers**

| Header | 必填 | 說明 |
| --- | --- | --- |
| `Authorization: Bearer <JWT>` | 是 | 使用者 JWT |

**Request Body**：無

**Response 200**

```json
{
  "success": true,
  "code": "OK",
  "data": {
    "device_token": "12d070102b3215b2c665dbf8479a3206f59bd0602b52eaa6918dc94449b8e799"
  }
}
```

**錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 401 | `TOKEN_MISSING` | Authorization header 不存在 |
| 401 | `TOKEN_INVALID_OR_EXPIRED` | JWT 格式錯誤、簽章不符或已過期 |

---

## `/v1/user` — 使用者資料（需 JWT）

所有 `/v1/user/*` endpoint 均需 `Authorization: Bearer <JWT>` header。

**共用 401 錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 401 | `TOKEN_MISSING` | Authorization header 不存在 |
| 401 | `TOKEN_INVALID_OR_EXPIRED` | JWT 格式錯誤、簽章不符或已過期 |

### `GET /v1/user/print-records`

查詢目前使用者的列印紀錄列表。支援依機台 IP/ID、機型、樹脂、dental mode、狀態與上傳日期範圍過濾。

**Query Params**

| 參數 | 型別 | 預設 | 說明 |
| --- | --- | --- | --- |
| `mainboard_ip` | string | — | 篩選機台 IP |
| `mainboard_id` | string | — | 篩選主板 ID |
| `machine_slug` | string | — | 篩選機型 slug |
| `resin_name` | string | — | 篩選樹脂名稱 |
| `dental_mode` | string | — | 篩選 dental mode |
| `status` | string | — | `uploaded` / `printing` / `success` / `failed` / `canceled` / `timeout` |
| `sdcp_task_id` | string | — | 篩選 SDCP task ID |
| `start_date` | ISO 8601 | — | `uploaded_at` 起始時間 |
| `end_date` | ISO 8601 | — | `uploaded_at` 結束時間 |
| `page` | int | `1` | 頁碼 |
| `page_size` | int | `20` | 每頁筆數 |

**Response 200**

```json
{
  "success": true,
  "code": "OK",
  "data": {
    "total": 150,
    "page": 1,
    "page_size": 20,
    "items": [
      {
        "record_id": 42,
        "status": "uploaded",
        "mainboard_ip": "192.168.1.100",
        "mainboard_id": "000000000001d354",
        "machine_slug": "sonic_ls_plus",
        "resin_name": "Dental Ortho Model",
        "dental_mode": "ortho_model",
        "filename": "model.prz",
        "sdcp_task_id": null,
        "slice_file_id": "file_slice_abc",
        "model_file_id": "file_model_abc",
        "file_archive_status": "completed",
        "uploaded_at": "2026-04-13T02:00:00.000Z",
        "started_at": null,
        "finished_at": null
      }
    ]
  }
}
```

**錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | `start_date` 或 `end_date` 不符合 ISO 8601 |
| 422 | `INVALID_DATE_RANGE` | `start_date` 晚於 `end_date` |
| 422 | `INVALID_STATUS_VALUE` | `status` 值不在允許列表內 |
| 422 | `INVALID_PAGE_SIZE` | `page_size` 小於 1 或超過上限 |
| 422 | `INVALID_PAGE` | `page` 小於 1 |

---

### `GET /v1/user/print-records/{record_id}`

取得單筆列印紀錄完整詳情，涵蓋機台資訊、機型/樹脂、dental mode、檔名、切片參數與 S3 檔案引用。

**Response 200**

```json
{
  "success": true,
  "code": "OK",
  "data": {
    "record_id": 42,
    "user_id": 12,
    "status": "success",
    "mainboard_ip": "192.168.1.100",
    "mainboard_id": "000000000001d354",
    "machine_slug": "sonic_ls_plus",
    "resin_name": "Dental Ortho Model",
    "dental_mode": "ortho_model",
    "filename": "model.prz",
    "slicing_params": {},
    "sdcp_task_id": "sdcp-task-001",
    "slice_file_id": "file_slice_abc",
    "model_file_id": "file_model_abc",
    "file_archive_status": "completed",
    "uploaded_at": "2026-04-13T02:00:00.000Z",
    "started_at": "2026-04-13T02:05:00.000Z",
    "finished_at": "2026-04-13T03:30:00.000Z",
    "last_status_at": "2026-04-13T03:30:00.000Z"
  }
}
```

**錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 404 | `RECORD_NOT_FOUND` | 紀錄不存在或不屬於目前使用者 |

---

### `GET /v1/user/print-records/{record_id}/model-file`

取得原始模型檔的 S3 presigned download URL，前端直接從 S3 下載，後端 3 不代理傳輸。

**Response 200**

```json
{
  "success": true,
  "code": "OK",
  "data": {
    "url": "https://s3.amazonaws.com/...",
    "expires_in": 900
  }
}
```

**錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 404 | `RECORD_NOT_FOUND` | 紀錄不存在或不屬於目前使用者 |
| 404 | `FILE_NOT_FOUND` | 紀錄存在但沒有模型檔，或檔案尚未確認上傳 |
| 410 | `FILE_EXPIRED` | 模型檔已超過 TTL |

---

## `/internal` — 後端 2 專用內部 API

所有 `/internal/*` endpoint 只允許後端 2 使用 `device_token` 呼叫。後端 3 SHALL 驗證 device token，並保留被操作的使用者 ID 與 record ID 以供稽核。

**共用 401 錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 401 | `DEVICE_TOKEN_MISSING` | Authorization header 缺漏 |
| 401 | `DEVICE_TOKEN_INVALID` | device token 不存在或無效 |

### `GET /internal/ping`

驗證 device token 是否有效。後端 2 啟動或重連時呼叫，確認 token 正確後再執行後續操作。

**Response 200**

```json
{ "success": true, "code": "OK", "data": {} }
```

---

### `POST /internal/print-records`

後端 2 在切片檔成功上傳至機台後建立 `uploaded` 列印紀錄。

**欄位規則**

| 欄位 | 必填 | 規則 |
| --- | --- | --- |
| `mainboard_ip` | 是 | 機台 IP 字串 |
| `mainboard_id` | 是 | 機台主板 ID |
| `filename` | 是 | 機台上的切片檔名 |
| `slicing_params` | 是 | object，可為空物件 |
| `uploaded_at` | 是 | ISO 8601 UTC datetime |
| `machine_slug` | 否 | 機型識別碼 |
| `machine_name` | 否 | 機型人類可讀名稱 |
| `resin_name` | 否 | 樹脂名稱 |
| `dental_mode` | 否 | Dental mode |
| `total_layers` | 否 | int，若提供則 SHALL ≥ 1 |
| `layer_height` | 否 | number，若提供則 SHALL ≥ 0.001 |

**Request Body**

```json
{
  "mainboard_ip": "192.168.1.100",
  "mainboard_id": "000000000001d354",
  "machine_name": "Sonic LS Plus",
  "machine_slug": "sonic_ls_plus",
  "resin_name": "Dental Ortho Model",
  "dental_mode": "ortho_model",
  "filename": "model.prz",
  "total_layers": 200,
  "layer_height": 0.05,
  "slicing_params": {},
  "uploaded_at": "2026-04-13T02:00:00.000Z"
}
```

**Response 201**

```json
{
  "success": true,
  "code": "OK",
  "data": {
    "record_id": 42,
    "status": "uploaded",
    "uploaded_at": "2026-04-13T02:00:00.000Z"
  }
}
```

**錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | 必填欄位缺漏、`uploaded_at` 非 ISO 8601、`slicing_params` 非 object、`total_layers` / `layer_height` 不符範圍 |

---

### `GET /internal/print-records/{record_id}`

後端 2 開始列印、停止列印或補償前，依 `record_id` 查詢機台與檔案資訊。

**Response 200**

```json
{
  "success": true,
  "code": "OK",
  "data": {
    "record_id": 42,
    "user_id": 12,
    "status": "uploaded",
    "mainboard_id": "000000000001d354",
    "mainboard_ip": "192.168.1.100",
    "filename": "model.prz"
  }
}
```

**錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 404 | `RECORD_NOT_FOUND` | 紀錄不存在 |

---

### `PATCH /internal/print-records/{record_id}`

後端 2 補寫檔案引用、機台狀態、完成/失敗/取消/timeout 結果。`user_id`、`mainboard_ip`、`mainboard_id`、`machine_slug`、`resin_name`、`dental_mode`、`filename`、`slicing_params` 為不可變欄位，PATCH SHALL NOT 允許修改。

**Request Body**

```json
{
  "status": "printing",
  "started_at": "2026-04-13T02:05:00.000Z",
  "finished_at": null,
  "last_status_at": "2026-04-13T02:05:00.000Z",
  "sdcp_task_id": "sdcp-task-001",
  "model_file_id": "file_model_abc",
  "slice_file_id": "file_slice_abc",
  "file_archive_status": "completed",
  "machine_status_raw": {}
}
```

**狀態機規則**

`status` 欄位只允許以下轉換，違反時回 `422 INVALID_STATUS_TRANSITION`：

| 現在狀態 | 允許轉換至 |
| --- | --- |
| `uploaded` | `printing` |
| `printing` | `success` / `failed` / `canceled` / `timeout` |
| `timeout` | `printing` / `success` / `failed` / `canceled` |
| `success` / `failed` / `canceled` | 不允許任何轉換（terminal） |

- `timeout` 可由後端 3 cron 自動標記，也可由後端 2 透過 PATCH 主動寫入。
- 相同狀態視為冪等，允許通過（適用後端 2 retry 場景）。
- 從 `timeout` 改回 `printing` 時，SHALL 同時帶 `last_status_at`（設為當下時間），否則 cron 可能在下次掃描週期重新標為 `timeout`。
- `sdcp_task_id` 在同一機台（`mainboard_id`）下必須唯一；寫入已存在的 task ID 時回 `422 TASK_ID_ALREADY_EXISTS`。

**Response 200**

```json
{
  "success": true,
  "code": "OK",
  "data": {
    "record_id": 42,
    "status": "printing",
    "updated_at": "2026-04-13T02:05:00.000Z"
  }
}
```

**錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | `status` 值不合法或時間欄位格式不符 |
| 422 | `IMMUTABLE_FIELD` | request body 包含不可修改欄位 |
| 422 | `INVALID_STATUS_TRANSITION` | 狀態轉換不符合狀態機規則 |
| 422 | `TASK_ID_ALREADY_EXISTS` | `sdcp_task_id` 已存在於同一機台的另一筆紀錄 |

---

### `GET /internal/print-records/timeouts`

取得需要由後端 2 透過 SDCP 歷史任務補償的 timeout 紀錄。

**Query Params**

| 參數 | 型別 | 預設 | 說明 |
| --- | --- | --- | --- |
| `mainboard_id` | string | — | 篩選指定主板 |
| `limit` | int | `100` | 單次回傳筆數 |
| `max_reconcile_attempts` | int | — | 只回傳補償嘗試次數未達上限的紀錄 |

**Response 200**

```json
{
  "success": true,
  "code": "OK",
  "data": {
    "items": [
      {
        "record_id": 42,
        "user_id": 12,
        "mainboard_id": "000000000001d354",
        "mainboard_ip": "192.168.1.100",
        "filename": "model.prz",
        "sdcp_task_id": "sdcp-task-001",
        "slice_file_id": "file_slice_abc",
        "uploaded_at": "2026-04-13T02:00:00.000Z",
        "started_at": "2026-04-13T02:05:00.000Z",
        "last_reconcile_at": null,
        "reconcile_attempts": 0
      }
    ]
  }
}
```

**錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | 查詢參數格式不符（ValidationPipe） |

---

### `POST /internal/print-records/{record_id}/reconcile-attempt`

記錄後端 2 對 timeout 紀錄的補償嘗試。若成功匹配並已確認結果，後端 2 SHALL 另呼叫 `PATCH /internal/print-records/{record_id}` 更新最終狀態。

**Request Body**

```json
{
  "matched": true,
  "matched_by": "sdcp_task_id",
  "checked_at": "2026-04-13T04:00:00.000Z",
  "machine_history_raw": {}
}
```

**Response 200**

```json
{
  "success": true,
  "code": "OK",
  "data": {
    "record_id": 42,
    "reconcile_attempts": 2,
    "last_reconcile_at": "2026-04-13T04:00:00.000Z"
  }
}
```

**錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 404 | `RECORD_NOT_FOUND` | 紀錄不存在 |
| 400 | `BAD_REQUEST` | `checked_at` 格式不符（ValidationPipe） |

---

### `POST /internal/files/upload-targets`

建立 S3 file reference、object key 與 presigned upload target，供後端 2 在回應前端後背景上傳切片檔與模型檔。此 API 只建立 upload target；檔案 bytes SHALL 由呼叫端直接 `PUT` 到回傳的 S3 presigned URL，S3 PUT 成功時 HTTP status SHALL 為 200。

**欄位規則**

| 欄位 | 必填 | 規則 |
| --- | --- | --- |
| `record_id` | 是 | 既有列印紀錄 ID |
| `files` | 是 | 非空陣列 |
| `files[].role` | 是 | 只允許 `slice` 或 `model` |
| `files[].filename` | 是 | 不得包含 `/` 或 `\` 路徑分隔符 |
| `files[].content_type` | 是 | 只允許 `application/octet-stream`（`.prz`）、`model/stl`（`.stl`）、`model/3mf`（`.3mf`） |

**Request Body**

```json
{
  "record_id": 42,
  "files": [
    { "role": "slice", "filename": "model.prz", "content_type": "application/octet-stream" },
    { "role": "model", "filename": "model.stl", "content_type": "model/stl" }
  ]
}
```

**Response 201**

```json
{
  "success": true,
  "code": "OK",
  "data": {
    "files": [
      {
        "file_id": "file_slice_abc",
        "role": "slice",
        "upload_url": "https://s3-presigned-upload-url",
        "object_key": "users/12/records/42/slice/model.prz"
      }
    ]
  }
}
```

**錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 404 | `RECORD_NOT_FOUND` | `record_id` 不存在 |
| 422 | `INVALID_FILE_ROLE` | `role` 不在 allowlist |
| 422 | `INVALID_FILE_TYPE` | `content_type` 或副檔名不在 allowlist |
| 400 | `BAD_REQUEST` | `files` 空陣列、`filename` 含路徑分隔符或欄位格式不符 |

---

### `POST /internal/files/{file_id}/confirm`

後端 2 上傳 S3 完成後，由後端 3 確認檔案 metadata 與可下載 TTL。呼叫 confirm 前，呼叫端 MUST 先把檔案 bytes `PUT` 到 `POST /internal/files/upload-targets` 回傳的 S3 presigned URL。確認成功後，後端 2 再用 `PATCH /internal/print-records/{record_id}` 補寫 `slice_file_id` / `model_file_id` 與 `file_archive_status`。

**欄位規則**

| 欄位 | 必填 | 規則 |
| --- | --- | --- |
| `uploaded_at` | 是 | ISO 8601 UTC datetime |
| `size` | 否 | number，若提供則 SHALL ≥ 0 |
| `hash` | 否 | 檔案 hash |
| `hash_algorithm` | 否 | 例如 `md5` |
| `content_type` | 否 | 實際上傳檔案 content type |

**Request Body**

```json
{
  "size": 9823311,
  "hash": "abc123",
  "hash_algorithm": "md5",
  "content_type": "application/octet-stream",
  "uploaded_at": "2026-04-13T02:01:00.000Z"
}
```

**Response 200**

```json
{
  "success": true,
  "code": "OK",
  "data": {
    "file_id": "file_slice_abc",
    "status": "uploaded"
  }
}
```

**錯誤碼**

| 狀態碼 | code | 情境 |
| --- | --- | --- |
| 404 | `FILE_NOT_FOUND` | `file_id` 不存在 |
| 422 | `INVALID_DATETIME_FORMAT` | `uploaded_at` 非 ISO 8601 格式 |
| 422 | `INVALID_NUMERIC_FIELD` | `size` 小於 0 或其他數值欄位格式不符 |
