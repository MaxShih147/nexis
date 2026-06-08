# 多模型 Undo/Redo 闕漏清單 Multi-Model Undo/Redo Gap Analysis

> 日期:2026-06 ｜ 分支:`feature/multi-model-support`
> 用途:盤點目前 undo/redo 子系統在「同時存在多個模型」下的闕漏,作為 Phase 1+ 的修補依據。
> 方法:直接讀 `UndoManager`、`commands/index.js` 與各 manager 的 soft add/remove 實作;附 `檔案:行` 依據。
> 結論先行:**核心命令已多模型就緒**;真正要補的是**支撐**與**壓字**兩個單例子系統,加上 undo 的**選取聚焦/標籤**,最後才是**批次處理的跨模型單步 undo**。

---

## 0. 架構速覽

- 單一**全域** undo/redo stack,`maxSteps = 50`,300ms 內同型別命令會 merge(`UndoManager.js:21-27, 198-207`)。
- 每個命令物件:`type, label, targetUuid, timestamp, apply(), undo(), canMerge(), merge()`(`commands/index.js:1-11`)。
- 模型刪除走可 undo 的 `removeModel` 命令;`purgeModel(uuid)` 依 `targetUuid` 過濾(含遞迴 compound)(`UndoManager.js:133-138, 209-216`)。
- Transaction:`beginTransaction / commitTransaction` 把多命令包成單一 compound(`UndoManager.js:153-180`)。
- 幾何快照存 IndexedDB,GC 以 `_refCount` 保護存活幾何(`GeometrySnapshotService.js:131-162`)。

---

## 1. ✅ 已經多模型正確

| 項目 | 依據 |
|---|---|
| 全域 stack,跨模型操作順序正常 | `UndoManager.js:62-127` |
| Transform(position/rotation/scale)命令 per-object(`targetUuid` + closure `_object`),merge 也比對 `targetUuid` | `commands/index.js:17-111` |
| Geometry 命令 per-object,快照走 snapshotService | `commands/index.js:261-318` |
| Add/Remove 模型命令 per-object | `commands/index.js:117-155` |
| Drill visual hole 命令帶 `selectedObject.uuid`、操作指定物件 | `commands/index.js:205-220` |
| `_softAddModel/_softRemoveModel` 逐物件管理 scene/dragControl/SelectionManager/faceSelectionManager/modelStore,移除時先 deselect | `MeshManager.js:921-979` |
| `purgeModel` 遞迴進 compound 子命令 | `UndoManager.js:209-216` |
| Snapshot GC 用 `_refCount` 保護存活幾何,與模型數無關 | `GeometrySnapshotService.js:144-146` |

> 換言之:**搬移、旋轉、縮放、挖空、鑽孔、加/刪模型** 的 undo/redo 在多模型下都會作用在正確的模型。

---

## 2. 🔴 真闕漏(多模型會壞 / 不正確)

### #1 支撐 Support 是「單一實例」── 最嚴重
- `SupportManager` 只持有一個 `this.supportMesh`。
- `_softAddSupportMesh(mesh, parentObject)` 會先 `_disposeSupportMesh()` 移除既有的;`_softRemoveSupportMesh()` 移除「那一個」且**沒有目標參數**。
  - 依據:`SupportManager.js:218-250`
- `backendStore` 的支撐狀態是**全域單例**:`hasSupportMesh`、`supportMeshId`。
  - 依據:`useBackendStore.js:59-60, 209-219`
- 命令 `createAddSupportMeshCommand/createRemoveSupportMeshCommand` 的 undo 直接呼叫無參數的 `_softRemoveSupportMesh()` 並改寫全域 `updateSupportState/clearSupportState/clearJob('support')`。
  - 依據:`commands/index.js:161-199`

**影響**:兩個模型無法各自有支撐;對 A 做支撐的 undo/redo 會操作到「當前那一個」並污染全域支撐旗標。**支撐及其 undo/redo 目前是單模型限定。**

**修補方向**:`SupportManager` 改為以 `parentObject.uuid` 管理「每模型一支撐」(map 或掛在 model 上);support 狀態改為 per-model;命令的 undo 帶上目標 uuid。
→ 詳細現況與重設計見 [多模型支撐重設計](./support-redesign.md)。**實作中**。

---

### #2 壓字 Tagging 預覽是單例
- 命令 `targetUuid: 'text-emboss-preview'`(**固定字串,非模型 uuid**);`textEmbossManager` 只有一份預覽狀態。
  - 依據:`commands/index.js:226-243`

**影響**:壓字非 per-model;刪模型時不會被 `purgeModel` 命中(uuid 對不上);切換模型不會隔離壓字歷史。與 e2e 流程 4.3「逐模型壓字」衝突。

**修補方向**:壓字預覽狀態與命令改綁實際模型 uuid;支援多模型各自的壓字。

---

## 3. 🟡 UX / 正確性(能動但多模型下會混淆)

### #3 undo/redo 不會聚焦被影響的模型
命令完全不碰 selection。對 B 的操作在 A 被選取時 undo,畫面不會切到 B、gizmo 仍停在 A,使用者看不出改了哪個。
- **修補方向**:undo/redo 後依命令 `targetUuid` 自動選取/聚焦該模型(gizmo 跟著走)。

### #4 標籤沒有模型身分
`undoLabel/redoLabel` 只有「move / hollow」等,N 個模型時不知道下一步動到誰。
- 依據:`UndoManager.js:48-56`
- **修補方向**:label 帶上模型名稱/序號。

### #5 `purgeModel` 定義了但全專案沒人呼叫
刪除走 `createRemoveModelCommand`(可 undo,`sceneCoordinator.js:583`)。所以刪掉的模型命令仍留在歷史(保留物件參考=輕微記憶體滯留),「刪除即 purge」沒接上。
- **待決策**:刪除維持可 undo(則 `purgeModel` 是死碼,可移除),或永久刪除時才呼叫 `purgeModel`。

### #6 maxSteps 全域共享
`maxSteps = 50` 是全域預算;多模型重編輯會更快擠掉舊歷史,與使用者「每模型各自歷史」的直覺不同。
- 依據:`UndoManager.js:21, 82-84`
- **修補方向(可選)**:視需求調整上限或改善逐出策略。

---

## 4. 🔮 對應未來批次功能(e2e 4.2)

### #7 批次「一件處理」跨多模型,缺單步 undo
e2e 4.2 要「對所選的多個檔一次一件處理」(auto-orient + 支撐 + 中空 ×N)。
- 現在 `autoProcess` 的 transaction **只包單一模型**;沒有跨 N 模型的批次。
- 且批次內的支撐又卡在闕漏 #1。
- **修補方向**:批次流程用 `beginTransaction/commitTransaction` 包成**單一跨模型 compound**;先解 #1 支撐 per-model。

### #8 compound 跨模型 + purge 的邊角
若 compound 跨 A、B 兩模型,刪 A 會因 `_cmdReferencesModel` 命中而 purge **整個** compound(連帶丟掉 B 的部分)。
- 依據:`UndoManager.js:209-216`
- **影響**:批次 compound 落地後才會顯著;屆時需重新設計 purge 對「部分命中」的處理。

---

## 5. 建議修補順序

1. **#1 支撐 per-model**(最嚴重,且阻擋 #7 批次)
2. **#2 壓字 per-model**(對應 e2e 4.3)
3. **#3 / #4 undo 後聚焦模型 + 標籤帶身分**(低風險、體驗大幅改善)
4. **#5 purgeModel 決策**(維持可 undo 或接上永久刪除)
5. **#7 批次處理跨模型單步 undo**(依賴 #1)
6. **#8 compound 部分命中 purge**(批次落地後處理)

---

## 變更紀錄
| 日期 | 版本 | 變更 |
|---|---|---|
| 2026-06 | v0.1 | 初版,從程式碼盤點。 |
