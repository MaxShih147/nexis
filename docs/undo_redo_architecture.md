# Undo/Redo Architecture

## Overview

DS-Online 的 undo/redo 系統使用 **Command Pattern**：每個可撤銷的操作被包裝成一個 command 物件，推入 undo stack。Undo 時 pop 出來執行 `undo()`，再推入 redo stack。

```
User action → create command → undoManager.push(cmd)
Cmd+Z       → undoManager.undo()  → cmd.undo()  → move cmd to redo stack
Cmd+Shift+Z → undoManager.redo()  → cmd.apply() → move cmd to undo stack
```

## File Map

```
src/
├── three/
│   ├── UndoManager.js                    # Stack 管理、transaction、merge、GC
│   ├── commands/
│   │   └── index.js                      # 所有 command factory 函數
│   ├── sceneCoordinator.js               # undo* wrapper 函數（呼叫端）
│   ├── snapshots/
│   │   ├── GeometrySnapshotService.js    # 幾何體快照：hash → encode → store
│   │   ├── IndexedDBSnapshotStore.js     # COLD storage（IndexedDB）
│   │   ├── SnapshotStore.js              # Store interface
│   │   └── normalizeGeometry.js          # 幾何體序列化/反序列化
│   └── workers/
│       └── workerPool.js                 # Web Worker pool（hash/encode/decode）
├── composables/
│   └── useUndoRedo.js                    # Cmd+Z / Cmd+Shift+Z 鍵盤綁定
└── stores/
    └── useUndoStore.js                   # Pinia store（UI 響應式狀態）
```

## UndoManager

`src/three/UndoManager.js`

核心職責：
- 維護 `_undoStack` 和 `_redoStack`（max 50 steps）
- `push(cmd)` — 推入 undo stack，清空 redo stack
- `undo()` / `redo()` — async，帶 mutex lock 防止並發
- Command merge — 300ms 窗口內的同類操作合併（例如連續拖動）
- Transaction — `beginTransaction` / `commitTransaction` 將多個 command 包成一個 compound
- `purgeModel(uuid)` — 模型永久刪除時清除相關 commands
- `clear()` — 清空所有歷史（載入專案檔時使用）
- `_syncUI()` — 同步到 Pinia store（`useUndoStore`）讓 UI 即時反映 canUndo/canRedo

### Async 執行

Geometry commands 需要從 IndexedDB 解碼幾何體，所以 `undo()` / `redo()` 是 async。
`_withLock()` 用 Promise-based mutex 確保同一時間只有一個 undo/redo 在執行。

### Transaction API

多步操作（如 auto process = orient + replace geometry）需要包成單一 undo 步驟：

```js
undoManager.beginTransaction('Auto Process')
// ... push multiple commands ...
undoManager.commitTransaction()  // → 包成一個 compound command
// 或
undoManager.rollbackTransaction()  // → 逐一 undo 已收集的 commands
```

## Command 類型

`src/three/commands/index.js`

每個 command 物件必須有：
```js
{
  type: string,           // 'position' | 'rotation' | 'scale' | 'geometry' | ...
  label: string,          // 顯示名稱（如 'Move', 'Hollow'）
  targetUuid: string,     // 操作對象的 uuid
  timestamp: number,
  apply(): void | Promise, // redo 時執行
  undo(): void | Promise,  // undo 時執行
  canMerge(other): bool,   // 是否可與下一個 command 合併
  merge(other): void,      // 執行合併
}
```

### Transform Commands（同步）

| Factory | Type | 說明 | Merge |
|---------|------|------|-------|
| `createPositionCommand` | `position` | 位移 | 300ms 內同物件合併 |
| `createRotationCommand` | `rotation` | 旋轉 | 300ms 內同物件合併 |
| `createScaleCommand` | `scale` | 縮放 | 300ms 內同物件合併 |

儲存 old/new 值，apply 設為 new、undo 設回 old。
Merge 機制：連續拖動 gizmo 或滑桿時，300ms 內的同類同物件操作只產生一個 command（更新 `_newValue`）。

### Lifecycle Commands（同步）

| Factory | Type | 說明 |
|---------|------|------|
| `createAddModelCommand` | `addModel` | 加入模型 |
| `createRemoveModelCommand` | `removeModel` | 移除模型 |
| `createAddSupportMeshCommand` | `addSupportMesh` | 加入支撐 |
| `createRemoveSupportMeshCommand` | `removeSupportMesh` | 移除支撐 |
| `createAddVisualHoleCommand` | `addVisualHole` | 放置鑽孔圓柱 |

使用 `_softRemoveModel` / `_softAddModel`（不 dispose geometry，只從 scene/store 移除/加回）。

### Geometry Command（async）

| Factory | Type | 說明 |
|---------|------|------|
| `createGeometryCommand` | `geometry` | 幾何體變更（hollow、drill apply、ortho replace） |

**這是最複雜的 command 類型**。改變幾何體時：

```
1. captureGeometrySnapshot(object)  → oldSnapshot { geometryRef, userData, ... }
2. 執行操作（hollow / drill boolean / replace geometry）
3. captureGeometrySnapshot(object)  → newSnapshot
4. createGeometryCommand({ oldSnapshot, newSnapshot, ... }) → push
```

`captureGeometrySnapshot` 做的事：
- `snapshotService.snapshotGeometry(geometry)` → canonicalize → hash → compress → IndexedDB
- 同時保存 `userData`、`originalGeometry`、`offsetMesh` 的 refs

Undo/redo 時調用 `snapshotService.loadGeometry(ref)` 從 IndexedDB 解碼並替換 geometry。

### Compound Command

`createCompoundCommand(label, subCommands)` — transaction commit 時使用。
Apply 按順序執行子 commands，undo 按逆序執行。

## Geometry Snapshot System

### 架構（兩層 cache）

```
                    ┌─────────────────────┐
Command 引用 ref ──→│  HOT cache (LRU 3)  │ 記憶體中的 BufferGeometry
                    │  Map<hash, geom>    │
                    └────────┬────────────┘
                             │ miss
                    ┌────────▼────────────┐
                    │  COLD (IndexedDB)   │ 壓縮 blob
                    │  hash → blob + meta │
                    └─────────────────────┘
```

### 流程

**Snapshot（存）：**
```
BufferGeometry
  → canonicalize (position, normal, index → typed arrays)
  → hash (SHA-256 in Worker)
  → deduplicate check
  → encode/compress (in Worker)
  → IndexedDB put
  → return { hash }
```

**Load（取）：**
```
{ hash }
  → HOT cache hit? → clone & return
  → IndexedDB get → decode (in Worker) → rebuild BufferGeometry
  → add to HOT cache → clone & return
```

### GC（垃圾回收）

`UndoManager._scheduleSweep()` 在每次 push 後 debounce 3 秒觸發。
Sweep 時收集 undo/redo stack 中仍被引用的 hashes，刪除未引用且超過 2GB 上限的舊 entries。

## SceneCoordinator 的 Undo Wrappers

`src/three/sceneCoordinator.js` 中，每個使用者可見的操作都有對應的 `undo*` wrapper：

| Wrapper | Command 類型 | 說明 |
|---------|-------------|------|
| `undoUpdatePosition` | position | UI 輸入改位置 |
| `undoUpdateRotation` | rotation | UI 輸入改旋轉 |
| `undoUpdateScale` | scale | UI 輸入改縮放 |
| `undoSetToCenter` | position | 置中 |
| `undoSetToBottom` | position | 貼平台 |
| `undoMirrorModel` | scale / addModel | 鏡射（clone 時是 addModel） |
| `undoExpandModel` | scale + position (transaction) | 放大到平台 |
| `undoLoadModel` | addModel | 載入 STL |
| `undoAddShape` | addModel | 加入基本形狀 |
| `undoHollow` | geometry (transaction) | 挖空 |
| `undoRestoreHollow` | geometry (transaction) | 還原挖空 |
| `undoAddSupportMesh` | addSupportMesh | 加入支撐 |
| `undoRemoveSupportMesh` | removeSupportMesh | 移除支撐 |
| `undoAutoOrient` | rotation + position (transaction) | 自動定向 |
| `undoReplaceModelGeometry` | geometry | 替換幾何（ortho 等） |
| `applyDrillCsgOperation` | geometry | 鑽孔 boolean apply |
| `autoProcess` | rotation + position + geometry/support (transaction) | 自動處理 |

### Gizmo Drag Hooks

TransformControls 和 DragControl 的 drag start/end 事件也會自動建立 command：

```
dragstart → 記錄 oldPosition/oldRotation/oldScale
dragend   → 建立 position/rotation/scale command → push
```

### Drill 特殊處理

Drill mode 中放置的 visual holes 各自有 `addVisualHole` command。
Apply boolean 時：
1. 從 undo stack 頂端移除所有同物件的 `addVisualHole` commands
2. 執行 boolean 操作
3. 推入一個 `geometry` command（包含 before/after snapshot）

這樣 undo drill apply 會恢復 boolean 前的幾何，而不是逐一移除 holes。

## 鍵盤快捷鍵

`src/composables/useUndoRedo.js`

- `Cmd+Z` (Mac) / `Ctrl+Z` (Windows) → `undoManager.undo()`
- `Cmd+Shift+Z` (Mac) / `Ctrl+Y` (Windows) → `undoManager.redo()`
- `Ctrl+Shift+Z` (Windows) 也兼容到 `undoManager.redo()`
- 當 `<input>` / `<textarea>` / `<select>` focus 時不攔截

## UI 狀態同步

`useUndoStore`（Pinia）提供以下響應式狀態給 UI 元件：
- `canUndo` / `canRedo` — 控制按鈕 disabled 狀態
- `undoLabel` / `redoLabel` — 顯示下一步操作名稱
- `isExecuting` — undo/redo 進行中（防止重複觸發）

`UndoManager._syncUI()` 在每次 push/undo/redo/clear 後自動同步。

## 新增可撤銷操作的步驟

1. 在 `commands/index.js` 建立 command factory（如果現有的不適用）
2. 在 `sceneCoordinator.js` 建立 `undo*` wrapper：
   - 記錄操作前狀態
   - 執行操作
   - 建立 command 並 `undoManager.push()`
3. 若操作會改變幾何體：
   - 操作前 `captureGeometrySnapshot()` → oldSnapshot
   - 執行操作
   - 操作後 `captureGeometrySnapshot()` → newSnapshot
   - 用 `createGeometryCommand()`
4. 若操作包含多個步驟，用 `beginTransaction()` / `commitTransaction()` 包裝
5. 在 API return object 中暴露 wrapper 函數
