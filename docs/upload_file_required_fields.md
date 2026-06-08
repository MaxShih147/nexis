# 前端送檔至機台：必填欄位分析

Endpoint：`POST /api/v1/printers/{printerId}/files`

---

## Spec 定義的必填欄位

| 欄位 | 位置 | 說明 | 缺漏時的錯誤碼 |
|---|---|---|---|
| `printerId` | path param | 機台 ID | `400 PRINTER_ID_REQUIRED` |
| `slice_file` | multipart file | `.prz` 或 `.ctb` 切片檔 | `400 FILE_REQUIRED` |
| `mainboardIP` | form field | 機台 IP（IPv4） | `400 PRINTER_IP_REQUIRED` / `400 INVALID_IP_ADDRESS` |
| `machine_slug` | form field | 機型識別碼（e.g. `sonic_ls_plus`） | `400 MACHINE_SLUG_REQUIRED` |
| `resin_name` | form field | 樹脂名稱 | `400 RESIN_NAME_REQUIRED` |
| `dental_mode` | form field | 牙科模式（e.g. `ortho_model`） | `400 DENTAL_MODE_REQUIRED` |
| `filename` | form field | 上傳後的檔名 | `400 BAD_REQUEST` |
| `slicing_params` | form field (JSON string) | 切片參數快照 | `400 BAD_REQUEST` |

**選填**：`model_file`（`.stl` 原始模型，供 S3 歸檔用）

---

## 前端實作現況

實作位置：`src/axios/sendPrintService.js:77`、`src/stores/printers.js:488`

| 欄位 | 實作方式 | 資料來源 |
|---|---|---|
| `slice_file` | 無條件 append | `fileItem.file` |
| `mainboardIP` | 無條件 append | `printer.ip` |
| `machine_slug` | **條件 append**（truthy 才送） | `paramsStore.profile?.machineName` |
| `resin_name` | **條件 append**（truthy 才送） | `paramsStore.profile?.resinName` |
| `dental_mode` | **條件 append**（truthy 才送） | `paramsStore.dentalMode` |
| `filename` | 條件 append（file.name 通常存在） | `fileItem.file.name` |
| `slicing_params` | `!== undefined` 才送；預設為 `{}` | `paramsStore.uiParams` |
| `model_file` | 有傳入才 append（目前 call site 未傳） | 呼叫端選填 |

---

## 缺口與風險

`machine_slug`、`resin_name`、`dental_mode` 三個欄位在 spec 中為**必填**，但前端以 truthy guard 條件送出：

```js
// src/axios/sendPrintService.js:101–106
if (machineSlug) formData.append('machine_slug', machineSlug)
if (resinName)   formData.append('resin_name', resinName)
if (dentalMode)  formData.append('dental_mode', dentalMode)
```

當 profile 未載入（`paramsStore.profile` 為 null）或 `dentalMode` 未設定時，這三個欄位會**靜默地缺漏**，後端回 `400`。

### 建議修正方向

在 `printers.js:uploadFile`（call site）呼叫 `printService.uploadFile` 前先做 guard：

```js
const machineSlug = _currentMachineSlug()
const resinName = _currentResinName()
const dentalMode = _currentDentalMode()

if (!machineSlug || !resinName || !dentalMode) {
  // 提示使用者選擇機型 / 樹脂 / 牙科模式後再上傳
  throw new Error(...)
}
```

這樣可以在送出 API 前給使用者明確錯誤，而不是讓後端回 `400` 後才顯示錯誤。

---

*參考來源：`api/printer_control.md`（帳號管理整合 API 節）、`src/axios/sendPrintService.js`、`src/stores/printers.js`*
