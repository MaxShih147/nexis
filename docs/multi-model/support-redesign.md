# 多模型支撐重設計 Multi-Model Support Redesign

> 日期:2026-06 ｜ 分支:`feature/multi-model-support`
> 關聯:[多模型 undo/redo 闕漏清單](./undo-redo-gaps.md) 的 #1。
> 目標(理想行為,參考赤兔 Chitubox):
> - 選 A → 長支撐 → A 長支撐
> - 再選 B → 長支撐 → B 長支撐,**A 的支撐保留**
> - 全選 → 長支撐 → 所有模型都長
> - 長支撐 / 移除支撐 **都進 undo/redo**

---

## 1. 目前行為(現況)

| 環節 | 現況 | 依據 |
|---|---|---|
| 觸發 | `SupportEditor` 生成鈕,需先選取單一模型 | `SupportEditor.vue:94-120` |
| 附著 | 支撐掛成「被選取模型」的 child,記 `mesh.userData.sourceModelUuid`,幾何轉 local | `SupportManager.js:106-122` |
| **儲存** | **單例** `this.supportMesh`,每次生成先 dispose 舊的 | `SupportManager.js:16, 159-161` |
| **狀態** | **全域單例** `supportState{hasSupportMesh, supportMeshId}` | `useBackendStore.js:57-61` |
| 後端 job | 以 modelId 分,切模型開新 job(但只有一個 slot) | `useBackendStore.js:34-48, 150-154` |
| Undo/Redo | 生成/移除都有命令,帶 `parentObject.uuid`;undo 走單例 `_softRemoveSupportMesh()` | `commands/index.js:161-199` |
| 控制鎖 | 有支撐時**整個場景控制凍結** | `sceneCoordinator.js:364-377` |
| 選取 | **單選**,無多選/全選 | `SelectionManager.js:25` |

**結論**:附著層面已 per-model(mesh 知道父模型),但「同時擁有多個支撐」被三個單例擋住——`SupportManager.supportMesh`、`backendStore.supportState`、全域控制鎖;另缺多選/全選與批次。

### 現況 vs 理想
| 理想 | 現況 |
|---|---|
| 選 A → A 長 | ✅ |
| 選 B → B 長(A 保留) | ❌ 生成 B 會 dispose A 的支撐 |
| 全選 → 全部長 | ❌ 無多選/全選/批次 |
| 長/移除進 undo/redo | ✅ 有命令,但只對單一支撐正確 |

---

## 2. 目標設計

### 資料模型
- `SupportManager`:單例 `supportMesh` → **per-model**。
  - `this.supportMeshes = new Map<modelUuid, Mesh>()`(或直接靠 child + `sourceModelUuid` 查找,不再 dispose 他人)。
  - API:`getSupportForModel(uuid)`、`hasSupportForModel(uuid)`、`addSupportMesh(blob, model)`、`removeSupportForModel(uuid)`、`_softAddSupportMesh(mesh, model)`、`_softRemoveSupportMesh(uuid)`、`_disposeSupportForModel(uuid)`。
- `backendStore`:`supportState` 單例 → **per-model**(`supportByModel[uuid] = { hasSupportMesh, supportMeshId }`);job 追蹤也 per-model。

### 行為
- 生成支撐作用在**目前選取集合**(1 / N / 全部),各模型獨立生成、互不覆蓋。
- 切換選取時,`SupportEditor` 的 has/移除狀態反映**該模型**。

### Undo/Redo
- 命令已是 `targetUuid` 基礎;undo/redo 改為針對**指定模型**的支撐(不再用單例 `_softRemove`)。
- 全選生成 → 包成**單一 compound**(一步 undo);需處理部分失敗。

### 控制鎖
- 全域凍結 → **per-model**:有支撐的模型鎖定變換,無支撐的仍可動。

### 選取(Phase B)
- `SelectionManager` 支援多選(Ctrl/Shift)+「全選」;UI 反映多選與每模型支撐狀態。

---

## 3. 實作階段

**Phase A — 支撐 per-model 地基(先做)**
1. `SupportManager`:singleton → `Map<uuid, mesh>`;所有 add/remove/soft/dispose/attach 改 per-model。
2. `backendStore`:`supportState` 與 job 追蹤改 per-model。
3. `commands`:add/remove 支撐命令的 apply/undo 改為操作指定模型 + per-model 狀態。
4. `sceneCoordinator`:`hasSupportMesh` 改查選取模型;控制鎖改 per-model;undo wiring 帶 uuid。
5. `SupportEditor`:has/移除狀態依選取模型。
→ 成果:選 A 長、選 B 長、A 保留;單選下完整 undo/redo。

**Phase B — 多選 + 全選 + 批次**
6. `SelectionManager` 多選 + 全選。
7. 生成作用於選取集合;全選/多選生成包成單一 compound。
8. UI:全選鈕、每模型支撐狀態、批次生成/移除。

---

## 變更紀錄
| 日期 | 版本 | 變更 |
|---|---|---|
| 2026-06 | v0.1 | 初版:現況盤點 + 目標設計 + 分階段。 |
