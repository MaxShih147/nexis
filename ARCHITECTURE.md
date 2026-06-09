# nexis — 工程架構文件

本文件說明 nexis 的內部結構、碰撞檢測管線、關鍵設計取捨與效能考量。使用導覽請見 [README](./README.md)。

---

## 1. 總覽

nexis 是一個**純前端**的數位孿生碰撞檢測工具。核心是一個 Three.js 場景，外加：

- 以 **BVH（three-mesh-bvh）** 做三角級的窄相位幾何查詢。
- 以 **R-tree（rbush）** 做寬相位空間索引。
- 以 **CSG（three-bvh-csg）** 算精確交集體積。
- Vue 3 + Pinia + PrimeVue 的 UI 層。

沒有後端、沒有 WASM 切片管線（皆已自前身專案移除）；建置產物為靜態 SPA。

---

## 2. 模組地圖

```
src/
├─ three/
│  ├─ sceneCoordinator.js          場景核心：相機/控制/渲染、模型載入、選取、
│  │                               變換、undo/redo、建築、散布、對外 API（inject('three')）
│  ├─ createBaseScene.js           scene/camera/renderer/grid/lights
│  ├─ managers/
│  │  ├─ MeshManager.js            模型新增/移除/變換、共用材質、形狀工廠
│  │  ├─ CollisionManager.js       ★ 碰撞引擎（寬相位 + 窄相位 + CSG + 高亮 + overlay）
│  │  ├─ SelectionManager.js       射線選取（並註冊 three-mesh-bvh 擴充）
│  │  ├─ ControlsManager.js        OrbitControls / TransformControls / DragControls
│  │  └─ FaceSelectionManager.js   面選取
│  ├─ building/BuildingGenerator.js  程序化建築（BSP 隔間、牆/門、結構柱網）
│  ├─ loaders/index.js             STL/OBJ 載入 → 單一雙面 Mesh
│  └─ UndoManager.js               指令堆疊、合併視窗、交易、快照 GC
├─ stores/
│  ├─ model.js                     模型清單（含命名去重、markRaw）
│  └─ collision.js                 碰撞結果 / ε / 逐物件覆寫
├─ components/features/
│  ├─ collision/                   浮動碰撞面板、分類過濾、安全間隙面板
│  ├─ building/BuildingPanel.vue   建築參數
│  └─ objects/ScatterPanel.vue     散布測試工具
└─ views/HomeView.vue              版面組裝 + 鍵盤快捷（刪除、undo）
```

`sceneCoordinator` 透過 `provide/inject('three')` 對外暴露 API（`checkCollisions`、`generateBuilding`、`scatterRandomObjects`、`computeExactMagnitude`…）。開發模式下亦掛在 `window.__nexis`，供測試與除錯。

---

## 3. 碰撞檢測管線

`CollisionManager` 為核心，採兩階段：

### 3.1 寬相位（broad phase）— R-tree

- 每個可碰撞物計算世界 AABB，投影成 XY 平面的 footprint（`{minX,minY,maxX,maxY}`），加上目前最大 ε 當 padding。
- 物件與建築部件分別建一棵 rbush。
- 對每個物件查詢其 footprint 範圍，得到空間鄰近的候選，避免 O(n²)。

### 3.2 窄相位（narrow phase）— BVH

對每組候選 `(a, b)` 計算相對矩陣 `inv(a.matrixWorld) · b.matrixWorld`，再：

| 判定 | API | 產出 |
|---|---|---|
| 相交 | `geomA.boundsTree.intersectsGeometry(geomB, rel)` | `status:'intersect'` |
| 接近（ε>0 且未相交） | `closestPointToGeometry(geomB, rel, …)` | `status:'near'`、最小間距、最近兩點 |

- **位置 Location**：相交取兩 AABB 交集中心；接近取兩最近點中點。
- **大小 Magnitude（近似）**：相交取兩 AABB 交集體積。
- 結果上限 `MAX_RESULTS = 4000`，避免病態密集場景拖垮記憶體與清單。

### 3.3 可碰撞物抽象

寬/窄相位都只依賴 `{ uuid, geometry, matrixWorld, box, setHighlight }`，因此**真實 Mesh、建築部件、（未來的）instanced 物件可一致互測**。引擎不在意物件來源——窄相位只看幾何與變換。

### 3.4 高亮

- 共用兩個高亮材質（紅/黃，半透明 + `polygonOffset` + `depthWrite:false` 避免與地板共面 z-fighting），**換材質參照**而非每物件複製，O(n+hits)。
- 透過 `_origMaterial` 記錄原材質以還原。instanced 物件改走 `setHighlight()` callback（per-instance 顏色）。

### 3.5 即時與增量

- `requestRealtimeCheck(uuid)` 以 rAF 節流。
- 拖曳單一物件時走 `checkFor(uuid)`：保留不含該物件的舊結果，只重算該物件對其他物件與建築 → 每幀成本最小。
- 新增/刪除/undo/redo 後皆觸發重新偵測，使面板同步。

---

## 4. 精確交集體積（CSG）

近似（AABB 體積）對軸對齊盒子剛好等於真值，但對旋轉或一般網格會高估。`computeExactVolume(aUuid,bUuid)` 提供真值：

1. 取兩物件幾何，做 CSG 前處理（見下）→ 包成 `Brush`，套各自世界矩陣。
2. `Evaluator.evaluate(brushA, brushB, INTERSECTION)` → 交集網格。
3. `computeMeshVolume(result)` → 真實體積；交集網格以洋紅 overlay 畫在場景（精準 Location）。

**按需計算**：CSG 較重，僅在使用者點選某干涉項時對該對計算；即時/大規模仍用近似。

### 匯入網格的兩個地雷（已處理）

- STL/OBJ 載入的幾何**非索引**（每三角形獨立頂點）→ CSG 半邊連通性失效。前處理會**只保留 position 並依位置焊接頂點**（`mergeVertices`）成 manifold，並快取於 `userData`。
- STL **無 uv**，而 Evaluator 預設讀 `position/uv/normal` 會在缺屬性時崩潰 → 設定 `evaluator.attributes = ['position']`（體積本就只需位置）。

---

## 5. 程序化建築生成

`BuildingGenerator.generateBuilding(params)`：

- `computeFloorSize`：依隔間數與面積範圍推出樓地板尺寸；地板格線隨之縮放。
- **BSP 隔間**：以二元切割把樓板切成目標數量的房間。
- **牆與門**：周界牆 + 內部隔間牆，每道牆用 `Shape + ExtrudeGeometry` 單體擠出含門洞（避免拼接縫在半透明下露出 z-fighting）；門洞高度為參數（門楣）。
- **結構柱網**：以 `minColumnSpacing` 為最小間距的規則格點，水平垂直對齊、可落在房間中央。
- 半透明綠色材質；各部件 `userData.buildingPart = 'wall' | 'column'`，並 `computeBoundsTree()` 以供碰撞。

---

## 6. 物件模型與效能

- 散布物件命名 `物件-1, 物件-2, …`；store 對重名自動去重為 `物件-1#1, 物件-1#2, …`。
- **Vue 響應式陷阱**：曾用 `{ ...mesh }` 展開 Mesh 進響應式陣列，導致 Vue 深度代理 `mesh.parent→scene→所有子節點`，每次新增 O(scene) → 整體 O(n²)。改用 **`markRaw(model)`** 後，100 物件由 ~1850ms 降到 ~38ms。
- 其他規模化修正：移除背面子 mesh（減半 draw call 與每物件 CDN 貼圖請求）、uuid `Set` 取代線性重複檢查、共用高亮材質、結果上限。
- **上限**：散布輸入與盤面總物件皆限 1000。
- **三維**：約 15% 散布物件懸空於隨機高度，且頂部不超過牆高（天花板）。

---

## 7. 座標系與單位

- 單位為**公分（cm）**。
- 上方向為 **Z**（`Object3D.DEFAULT_UP = (0,0,1)`）；地板在 `z = 0`，物件底面貼地（懸空者除外）。

---

## 8. 狀態管理

- `stores/model.js`：模型清單、選取（主選取 + 多選 `selectedUuids`）、命名去重。
- `stores/collision.js`：碰撞結果、全域 ε、逐物件 ε 覆寫、結果上限旗標。
- UI 透過 storeToRefs 訂閱；碰撞結果由 `CollisionManager.onResults` 推入 store。

---

## 9. Undo / Redo

`UndoManager`：固定步數上限、300ms 內指令合併、Promise 互斥鎖、交易、依 uuid 清除已刪模型的指令、快照 GC。新增 `onAfterUndoRedo` hook：undo/redo 完成後重新偵測碰撞，使面板同步。

---

## 10. 測試

- **Vitest**：`CollisionManager` 等單元測試。
- **Cypress（Electron headless）**：開機煙霧測試、碰撞、建築、規模、About、截圖。開發模式的 `window.__nexis` API 供 e2e 驅動。

---

## 11. 已知限制與未來工作

- **單樓層**：目前為單一固定樓板。多樓層可加入樓層 Z 分區，碰撞依樓層分桶（跨樓層不互測），UI 以樓層選擇/剖面切換。
- **規模 vs 可拖曳**：真實 Mesh 易拖曳但萬件時 draw call 受限；InstancedMesh 可 1 個 draw call 撐萬件，但逐個選取/拖曳需「選取代理」技巧（射線取 instanceId → 暫時 proxy mesh 掛 gizmo → 回寫 instanceMatrix）。碰撞側因 collidable 抽象已可直接相容。
- **穿透深度**：目前量化以體積為主；穿透深度（如 EPA / MTV）尚未實作。

---

## 作者

Max Shih — [github.com/MaxShih147](https://github.com/MaxShih147)
