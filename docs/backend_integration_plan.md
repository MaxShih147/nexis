# Backend Integration Plan - PrusaSlicer Backend

## 1. Overview

整合 PrusaSlicer backend 到現有前端應用，實現三個核心功能：
- **Support Generation (長支撐)**: 後端生成支撐 mesh
- **Auto Processing (一鍵處理)**: WASM 旋轉 + 後端處理
- **Slicing (切片)**: 後端切片 + 前端 PRZ/ZIP 打包

### 關鍵需求
- 維持舊版前端流程可用性
- 支援 `frontend` / `backend` / `disabled` 三種模式切換
- Server 不可用時自動 fallback 到 frontend

---

## 2. Architecture

### Mode Switching Mechanism

```
┌─────────────────────────────────────────────────┐
│          useBackendStore (Pinia)                │
├─────────────────────────────────────────────────┤
│  serverStatus.available  ──┐                    │
│  preferBackend (user)    ──┼──► effectiveMode   │
│                            │    'frontend' |    │
│                            │    'backend'  |    │
│                            │    'disabled'      │
└─────────────────────────────────────────────────┘
```

- 啟動時檢測 server 可用性 (`GET /`)
- 定期 health check (30s)
- 使用者可手動切換偏好
- Server 不可用時自動 fallback 到 frontend

### Service Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    UI Components                             │
│         (SlicerButton, SupportEditor, ModelToolbar)          │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                             │
│     (slicingService, supportService, autoProcessingService)  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  1. Resolve mode ('auto' → effectiveMode)              │ │
│  │  2. 業務邏輯驗證 (共用驗證，不管哪個 mode)              │ │
│  │  3. Route to implementation                            │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
┌──────────────────────┐     ┌──────────────────────┐
│   Frontend Path      │     │   Backend Path       │
│   (WASM/Local)       │     │   (backendService)   │
│                      │     │                      │
│ - SlicerManager      │     │ - 資料格式驗證       │
│ - dao.js             │     │ - HTTP calls         │
│ - Mechado WASM       │     │                      │
└──────────────────────┘     └──────────────────────┘
```

### Validation Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    驗證分層策略                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Service Layer - 業務邏輯驗證                                │
│  ├── 參數範圍檢查 (e.g., layerHeight > 0)                    │
│  ├── 模式組合驗證 (e.g., orthodontic 模式需要特定參數)       │
│  └── 業務規則 (e.g., support 需要先有模型)                   │
│                                                              │
│  backendService.js - 資料格式驗證                            │
│  ├── 必填欄位檢查 (e.g., jobId 不可為空)                     │
│  ├── 類型檢查 (e.g., config 必須是 object)                   │
│  └── API schema 驗證 (e.g., FormData 格式正確)               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### File Structure

```
src/
├── axios/
│   ├── axios.js                  # backend axios instance
│   └── backendService.js         # V2 API wrapper
│
├── services/
│   ├── index.js                  # 統一匯出
│   ├── supportService.js         # 支撐生成抽象層
│   ├── autoProcessingService.js  # 一鍵處理抽象層
│   ├── slicingService.js         # 切片抽象層
│   └── errors.js                 # 錯誤類型定義
│
├── stores/
│   └── useBackendStore.js        # 後端狀態 + Job 管理
│
└── components/
    └── dialogs/
        └── ServerStatusDialog.vue
```

---

## 3. Job Management

### Job ID 設計原則

**核心規則：**
1. **不同操作類型使用獨立 Job ID** - Support、Hollow、Slicing 各自維護獨立的 Job
2. **不同模型需要不同 Job ID** - 當模型變更時，相關的 Job 必須失效
3. **Job ID 存放於 Store** - 集中管理於 `useBackendStore.jobs`

**為什麼需要獨立 Job？**
- 後端每個 Job 有獨立的狀態和產出檔案
- 不同操作可能並行執行
- 模型變更時只需清除相關 Job，不影響其他操作

### Job 生命週期

```
┌─────────┐    create    ┌─────────┐    upload    ┌─────────┐
│  null   │ ──────────►  │ created │ ──────────►  │ ready   │
└─────────┘              └─────────┘              └─────────┘
                                                       │
                                                       │ execute
                                                       ▼
┌─────────┐   model      ┌─────────┐              ┌─────────┐
│  null   │ ◄────────    │completed│ ◄────────    │processing│
└─────────┘   changed    └─────────┘   done       └─────────┘
```

**狀態說明：**
- `null`: 無 Job，需建立新 Job
- `created`: Job 已建立，尚未上傳模型
- `ready`: 模型已上傳，可執行操作
- `processing`: 執行中
- `completed`: 操作完成，結果可用
- 模型變更時：Job 回到 `null`，產出被清除

### Job Store 結構

```javascript
// useBackendStore.jobs 結構
{
  jobs: {
    support: {
      id: string | null,      // Job ID
      modelId: string | null, // 關聯的模型 ID
      status: JobStatus,      // 'created' | 'ready' | 'processing' | 'completed'
    },
    hollow: {
      id: string | null,
      modelId: string | null,
      status: JobStatus,
    },
    slicing: {
      id: string | null,
      modelId: string | null,
      status: JobStatus,
    }
  }
}
```

**modelId 關聯機制：**
- 建立 Job 時記錄當前模型的 `meshId`
- 每次操作前檢查：若 `modelId !== currentMeshId`，則清除 Job 並重建

### Job Workflow

**標準工作流程：**
```
Create Job → Upload Model → (Update Config) → Execute → Fetch Result
```

**何時建立新 Job？**
| 情境 | 行為 |
|------|------|
| 該操作類型無 Job | 建立新 Job |
| 模型已變更 (`modelId` 不符) | 清除舊 Job，建立新 Job |
| Job 狀態為 `completed` 但需重新執行 | 可重用 Job（若模型未變） |

**模型變更時的處理：**
1. 清除相關的 `jobs[type]`
2. 移除場景中的產出 mesh（如 supportMesh）
3. 下次操作時自動建立新 Job

**Job 重用判斷邏輯：**
```
function shouldCreateNewJob(type, currentModelId):
  job = jobs[type]
  if job.id is null:
    return true  // 無 Job
  if job.modelId !== currentModelId:
    return true  // 模型已變更
  return false   // 可重用
```

---

## 4. Features

### 4.1 Support Generation (長支撐)

**Data Flow：**
```
SupportEditor.vue
    │
    └── [Generate] → supportService.generate()
                         │
                         ├── 1. Resolve mode
                         ├── 2. Validate params
                         │
                         ├── if mode === 'frontend':
                         │     └── return (僅顯示視覺 markers，不生成實際 mesh)
                         │
                         └── if mode === 'backend':
                               ├── Check/Create Job (support)
                               ├── Upload model (if needed)
                               ├── POST /generate-supports
                               └── Fetch STL → Add mesh to scene
```

**API Endpoints：**
| Step | Method | Endpoint |
|------|--------|----------|
| Create Job | POST | `/api/v2/slices` |
| Upload Model | POST | `/api/v2/slices/{jobId}/upload` |
| Generate | POST | `/api/v2/slices/{jobId}/generate-supports` |
| Fetch Result | GET | `/api/jobs/{jobId}/support.stl` |

**模型變更處理：**
- 縮放/旋轉模型時，清除 `jobs.support` 並移除 `supportMesh`

### 4.2 Auto Processing (一鍵處理)

**Data Flow：**
```
ModelToolbar.vue → autoProcessingService.process()
                        │
                        ├── 1. Resolve mode
                        ├── 2. Validate params
                        │
                        ├── if mode === 'frontend':
                        │     └── 僅執行 WASM 旋轉
                        │         rotationRad = dao.computeAutoOrientation()
                        │         applyRotation(mesh, rotationRad)
                        │         return
                        │
                        └── if mode === 'backend':
                              │
                              │  Step 1: WASM Auto-orientation
                              │  rotationRad = dao.computeAutoOrientation()
                              │
                              ├── Orthodontic Model:
                              │     POST /generate-hollow → Replace geometry
                              │
                              └── Other modes (C&B, Splint, etc.):
                                    POST /generate-supports → Add supportMesh
```

**Mode Decision Matrix：**
| Dental Mode | Backend Operation | Output |
|-------------|------------------|--------|
| Orthodontic Model | Hollow + Open Bottom | 修改模型 geometry |
| C&B | Generate Supports | 新增 supportMesh |
| Splint | Generate Supports | 新增 supportMesh |
| Surgical Guide | Generate Supports | 新增 supportMesh |

**API Endpoints：**
| Operation | Method | Endpoint |
|-----------|--------|----------|
| Hollow | POST | `/api/v2/slices/{jobId}/generate-hollow` |
| Hollow Result | GET | `/api/jobs/{jobId}/hollow.stl` |
| Supports | POST | `/api/v2/slices/{jobId}/generate-supports` |
| Supports Result | GET | `/api/jobs/{jobId}/support.stl` |

### 4.3 Slicing (切片)

**Data Flow：**
```
SlicerButton.vue → slicingService.slice()
                        │
                        ├── 1. Resolve mode
                        ├── 2. Validate params
                        │
                        ├── if mode === 'frontend':
                        │     └── 使用 SlicerManager 本地切片
                        │         SlicerManager.slice() → WASM slicing
                        │         → PRZ/ZIP 打包
                        │         return
                        │
                        └── if mode === 'backend':
                              ├── Check/Create Job (slicing)
                              ├── Upload model + Update config
                              ├── POST /execute
                              ├── Fetch PNGs + metadata
                              │
                              ├── PRZ Mode:
                              │     RLE compress → Mechado GetPRZ_JS() → PRZ file
                              │
                              └── ZIP Mode:
                                    Mechado GetGcode_JS(layerCount) → ZIP file
```

**Hybrid Processing：**
```
Backend (PrusaSlicer)              Frontend (Browser)
─────────────────────────────────────────────────────────
     │                                   │
     │ ◄── Upload STL ─────────────────  │
     │ ◄── Slice params ───────────────  │
     │                                   │
  [Slice]                                │
     │                                   │
     │ ──► PNGs ───────────────────────► │
     │ ──► printTime/volume ───────────► │
     │                                   │
     │                              [Mechado WASM]
     │                                   │ RLE / GCode
     │                                   │ PRZ generation
     │                                   ▼
     │                              [Final Output]
```

**API Endpoints：**
| Step | Method | Endpoint |
|------|--------|----------|
| Create Job | POST | `/api/v2/slices` |
| Update Config | PUT | `/api/v2/slices/{jobId}/config` |
| Upload Model | POST | `/api/v2/slices/{jobId}/upload` |
| Execute | POST | `/api/v2/slices/{jobId}/execute` |
| Fetch Layer | GET | `/api/jobs/{jobId}/layers/{idx}.png` |

---

## 5. State Management

### useBackendStore 結構

```javascript
{
  // Server status
  serverStatus: {
    available: boolean,
    lastChecked: timestamp,
    version: string,
    capabilities: ['supports', 'hollow', 'slicing']
  },

  // Mode control
  preferBackend: boolean,        // User preference (localStorage)
  effectiveMode: computed,       // 'frontend' | 'backend'

  // Dialog control
  showServerDialog: boolean,

  // Job tracking (per operation type)
  jobs: {
    support: { id, modelId, status },
    hollow: { id, modelId, status },
    slicing: { id, modelId, status }
  },

  // Support state
  supportState: {
    hasSupportMesh: boolean,
    supportMeshId: string
  }
}
```

### Job Tracking Actions

| Action | 說明 |
|--------|------|
| `createJob(type)` | 建立指定類型的 Job，記錄 modelId |
| `clearJob(type)` | 清除指定類型的 Job |
| `clearJobsForModel(modelId)` | 清除所有關聯此 modelId 的 Jobs |
| `updateJobStatus(type, status)` | 更新 Job 狀態 |

---

## 6. Async Job Polling

### 問題描述

後端操作 (`generate-supports`, `generate-hollow`, `execute`) 是異步的：
- 發送 POST 請求後，後端返回成功但 Job 進入 `processing` 狀態
- 立即調用 `GET /api/jobs/{jobId}/support.stl` 會得到 **400: Job is not completed (status: processing)**

### 解決方案：Job Status Polling

在 `backendService.js` 實作通用的 polling 機制，所有需要等待結果的操作都使用此機制。

#### 架構圖

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Service Layer                                    │
│   (supportService, slicingService, autoProcessingService)               │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      backendService.js                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   1. generateSupports(jobId)     ──► POST /generate-supports            │
│                                       │                                  │
│   2. pollJobUntilComplete(jobId) ──► GET /api/v2/slices/{jobId}         │
│                                       │  (loop until completed/failed)   │
│                                       │                                  │
│   3. getSupportStl(jobId)        ──► GET /api/jobs/{jobId}/support.stl  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### backendService.js 新增功能

| 函數 | 說明 |
|------|------|
| `getJobStatus(jobId)` | GET `/api/v2/slices/{jobId}` 查詢狀態 |
| `pollJobUntilComplete(jobId, options)` | Loop 直到 `completed`/`failed`/timeout |

**Options:**
- `interval`: polling 間隔 (default: 500ms)
- `timeout`: 最大等待時間 (default: 60000ms)
- `onProgress(status)`: 狀態更新 callback

#### errors.js 新增錯誤類型

| 錯誤類型 | Code | 說明 |
|----------|------|------|
| `JobTimeoutError` | `JOB_TIMEOUT` | Polling 超時 |
| `JobFailedError` | `JOB_FAILED` | 後端執行失敗 |

#### Service Layer 修改重點

```javascript
// ❌ Before (400 error)
await generateSupports(jobId)
await getSupportStl(jobId)

// ✅ After
await generateSupports(jobId)
await pollJobUntilComplete(jobId, { timeout: 120000 })
await getSupportStl(jobId)
```

### 操作類型的 Timeout 建議

| 操作 | 建議 Timeout | 說明 |
|------|-------------|------|
| `generate-supports` | 120s | 支撐點數量影響時間 |
| `generate-hollow` | 120s | 模型複雜度影響時間 |
| `execute` (slicing) | 300s | 層數多時需較長時間 |
| `cut` | 30s | 相對較快 |
| `boolean` | 60s | 取決於 mesh 複雜度 |

### Loading Dialog 整合

Polling 期間需顯示 loading dialog 讓用戶知道正在處理：

```
┌────────────────────────────────────────────┐
│  Component (e.g., SupportEditor.vue)       │
├────────────────────────────────────────────┤
│  1. showLoadingDialog('Generating...')     │
│  2. await generateSupportMesh(...)         │
│     └─► 內部執行 polling                   │
│  3. hideLoadingDialog()                    │
└────────────────────────────────────────────┘
```

**實作方式：** 在 component 層呼叫 service 前後控制 `LoadingDialog`

### useBackendStore 狀態同步

- `onProgress` callback 更新 `jobs[type].status`
- UI 可根據 status 顯示狀態或禁用按鈕

---

## 7. Error Handling

### Fallback Strategy

當 backend 操作失敗時：
1. 記錄錯誤並顯示 toast 提示
2. 若為 `SERVER_UNAVAILABLE`，更新 `serverStatus.available = false`
3. 自動 fallback 到 frontend 流程（若可用）

### Error Codes

| Code | Message | Action |
|------|---------|--------|
| `SERVER_UNAVAILABLE` | Backend unavailable | 自動 fallback |
| `MODEL_UPLOAD_FAILED` | Upload failed | 提供重試按鈕 |
| `JOB_NOT_FOUND` | Job expired | 重建 Job |
| `SLICING_FAILED` | Slicing failed | 提供 fallback 選項 |

---

## 8. Implementation Phases

### Phase 1: Foundation ✅
- [x] Create `useBackendStore.js` (含 health check、mode 切換、jobs 結構)
- [x] Create `backendService.js` with API wrapper
- [x] Add `backend` axios instance
- [x] Create `ServerStatusDialog.vue`
- [x] Initialize store on app startup

### Phase 2: Support Generation ✅
- [x] Extend `SupportManager.js` (supportMesh 管理)
- [x] Create `supportService.js`
- [x] Update `SupportEditor.vue` (Generate/Delete 按鈕 + backend params UI)
- [x] Add transform cleanup (模型變更時清除 support)

### Phase 2.5: Async Job Polling ✅
- [x] **backendService.js** - 新增 `getJobStatus()` 和 `pollJobUntilComplete()`
- [x] **errors.js** - 新增 `JobTimeoutError` 和 `JobFailedError`
- [x] **supportService.js** - 在 fetch STL 前 poll 等待 completed
- [x] **SupportEditor.vue** - polling 期間顯示 ProgressDialog
- [ ] **後續 service** - slicingService / autoProcessingService 相同 pattern

### Phase 3: Slicing
- [ ] Create `slicingService.js`
- [ ] Create params converter (frontend → Prusa format)
- [ ] Update `SlicerManager.js`
- [ ] Implement hybrid PRZ/ZIP flows

### Phase 4: Auto Processing
- [ ] Create `autoProcessingService.js`
- [ ] Update `MeshManager.autoProcess()`
- [ ] Add mode-specific paths (Orthodontic vs others)

---

## 9. Verification

### Testing Checklist

**Support Generation：**
- [ ] 載入模型 → Generate → 確認 supportMesh 出現
- [ ] 縮放/旋轉模型 → 確認 supportMesh 被清除
- [ ] Delete → 確認 supportMesh 移除
- [ ] (Polling) 確認不會出現 "Job is not completed" 400 錯誤
- [ ] (Polling) 確認 timeout 超時會正確顯示錯誤訊息

**Auto Processing：**
- [ ] Orthodontic mode → 確認模型 geometry 被修改
- [ ] Other modes → 確認 supportMesh 被加入

**Slicing：**
- [ ] PRZ mode → 確認 PRZ 檔案可下載
- [ ] ZIP mode → 確認 ZIP 包含 PNGs + gcode
- [ ] 確認 printTime/volume 顯示正確

**Mode Switching：**
- [ ] 停止 backend → 確認 fallback 到 frontend
- [ ] 恢復 backend → 確認自動偵測並切回

**Job Management：**
- [ ] 模型變更後重新操作 → 確認建立新 Job
- [ ] 同一模型重複操作 → 確認重用 Job
