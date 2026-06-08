# 後端 API 契約文件

最後更新：2026-04-15

此資料夾是前端串接後端 API 的主要依據。任何會影響 request 格式、response 格式、headers、驗證方式、HTTP status code 或 error code 的後端 API 變更，都必須同步更新此資料夾中的對應文件。

## 後端清單

| 後端 | 文件 | 狀態 | 來源 |
| --- | --- | --- | --- |
| slicing_core | [slicing_core.md](./slicing_core.md) | 已實作 | `/Users/chloechang/Desktop/workspace/web_slicer_core` |
| printer_control | [printer_control.md](./printer_control.md) | 部分已實作 | `/Users/chloechang/Desktop/workspace/cursor/WebSlicer_PrinterControl` |
| account_management | [account_management.md](./account_management.md) | 尚未實作 | `openspec/changes/account-management` |

## OpenSpec 判斷

這次工作適合直接作為文件整理，不需要建立完整 OpenSpec 實作變更。原因是本次目標是記錄現有後端行為，並建立未來維護規則；沒有新增 runtime 行為、資料庫 migration 或使用者可見功能。

未來若符合以下任一情境，應使用 OpenSpec 流程：

- 新增 endpoint。
- endpoint 的 method、path、request body、response body、auth 或 header 需求改變。
- 新增、移除、重新命名或跨後端統一 error code。
- 實作後端 3 帳號管理。
- 後端 2 機台連線服務開始呼叫後端 3 的 internal API。

若 OpenSpec change 影響 API 行為，tasks 必須包含：

```md
- [ ] 更新 `api/<backend>.md`，同步 endpoint/header/body/response/error 變更。
- [ ] 若後端職責、base URL 或全域規則改變，更新 `api/README.md`。
```

## 文件格式

每份後端文件使用相同結構：

1. 基本資訊
2. OpenSpec 維護規則
3. Base URL 與服務職責
4. Headers 與身份驗證
5. 共用 response 與 error 格式
6. 資料模型
7. Endpoint 清單
8. Error code 登錄表
9. 已知缺口

每個 endpoint row 至少需包含：

| 欄位 | 必填 | 說明 |
| --- | --- | --- |
| Method + Endpoint | 是 | HTTP method 與 path，包含 path params。 |
| 功能簡介 | 是 | 以前端串接角度描述用途。 |
| Params | 是 | Path/query/form params 與必填狀態；沒有則寫 `None`。 |
| Request Body | 是 | JSON 或 multipart schema；沒有則寫 `None`。 |
| Response Body | 是 | JSON 欄位或 binary/SSE output。 |
| Errors | 是 | HTTP status 與現行或目標 error code。 |
| Headers | 是 | 特殊 request 或 response headers；沒有則寫 `None`。 |

## Error Code 管理規則

目前三個後端狀態不一致：

- `slicing_core` 多數錯誤回傳 FastAPI 預設 `{ "detail": "..." }`，沒有 `code` 欄位。
- `printer_control` 多數已實作 endpoint 會回傳結構化 JSON，但只有 upload middleware 與 rate limit response 會明確帶 `error.code` 或 `code`。
- `account_management` 尚未實作。

未來統一管理時，各後端應收斂到：

```json
{
  "success": false,
  "code": "DOMAIN_SPECIFIC_CODE",
  "message": "Human-readable message",
  "details": {},
  "timestamp": "2026-04-15T00:00:00.000Z"
}
```

在實作尚未統一前，每份後端文件都要區分：

- **現行錯誤格式**：目前後端實際回傳的格式。
- **文件化 code**：前端可先用來 mapping、後端未來應實際輸出的穩定 code 名稱。
