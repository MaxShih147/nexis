# 參數 Mapping 說明

本文件以 **目前程式實作** 為準，權威來源如下：

- `src/params/mappingTables.js`
- `src/params/adapters.js`
- `src/params/importProfileXml.js`
- `src/params/exportProfileXml.js`

## 流向總覽

- `Machine Profile JSON` → `UI`
- `Resin Profile JSON` → `UI`
- `UI` → `Machine Profile JSON`
- `UI` → `Resin Profile JSON / Resin XML`
- `UI` → `切片演算法輸出`

## 表格閱讀規則

- 本文件以 **resin profile key** 為主軸列舉，所有欄位整合於下方單一對照表。
- `匯出 Resin JSON 欄位` 指的是匯出流程中的記憶體中間結構，不會回寫污染 `src/data/resin_profiles/*.json`。
- `匯出 XML tag` 指的是最後 `buildExposureDataXml()` / `buildResinConfigXml()` 寫出的 tag。
- `-` 代表該流向不適用：
  - `Resin Profile Key` 為 `-`：不從 resin 載入 UI（原 C 類，含 Machine-only / UI-only）。
  - `UI 名稱` / `UI Path` 為 `-`：不進 UI（原 D 類，保留原值 / 結構容器 / 固定值）。
- `Slicer Output Key` 欄位 `x` 代表不輸出到切片演算法。
- 分類標記見 `備註` 欄。

## 完整對照表

| Resin Profile Key | UI 名稱 | UI Path | Machine Profile Key | 匯出 Resin JSON 欄位 | 匯出 XML tag | Slicer Output Key | 備註 |
|---|---|---|---|---|---|---|---|
| `thickness_configs[].thickness_mm` | 層高 | `print.layerHeight` | `Print.Layer Height` | `thickness_configs[].thickness_mm`、`modes[].thickness_mm` | `DefaultThickness.ThicknessValue` | `layer_height` | - |
| `modes[].base_layers` | 底層層數 | `print.bottom.layers` | `Print.Bottom Layer Count` | `modes[].base_layers` | `NumBaseLayer` | x | - |
| `modes[].base_curing_time` | 底層曝光時間 | `print.bottom.exposure` | `Print.Bottom Exposure Time` | `modes[].base_curing_time` | `BaseCuringTime` | x | - |
| `modes[].normal_curing_time` | 曝光時間 | `print.exposure` | `Print.Exposure Time` | `modes[].normal_curing_time` | `NormalCuringTime` | x | - |
| `modes[].normal_wait_before_print` | 關燈延遲 | `print.lightOffDelay` | `Print.Rest After Retract`、`Print.Bottom Rest After Retract` | `modes[].normal_wait_before_print` | `NormalWaitBeforePrint` | x | - |
| `modes[].normal_wait_after_print` | 抬升前延遲 | `print.restBeforeLift` | `Print.Rest Before Lift`、`Print.Bottom Rest Before Lift` | `modes[].normal_wait_after_print` | `NormalWaitAfterPrint` | x | - |
| `modes[].normal_wait_lift` | 抬升後延遲 | `print.restAfterLift` | `Print.Rest After Lift`、`Print.Bottom Rest After Lift` | `modes[].normal_wait_lift` | `NormalWaitLift` | x | - |
| `modes[].buffer_layer_number` | 過渡層層數 | `print.transition.count` | `Print.Transition Layer Count` | `modes[].buffer_layer_number` | `BufferLayerNumber` | x | - |
| `modes[].base_lift_height` | 底層抬升距離 | `motion.bottom.liftHeight` | `Print.Bottom Lifting Distance` | `modes[].base_lift_height` | `BaseLiftHeight` | x | - |
| `modes[].bottom_retract_second_dist` | 底層回程距離 | `motion.bottom.retractDistance` | `Print.Bottom Retract Second Distance` | `modes[].bottom_retract_second_dist` | `bottomRetractSecondDistInputFile` | x | - |
| `modes[].normal_lift_height` | 抬升距離 | `motion.normal.liftHeight` | `Print.Lifting Distance` | `modes[].normal_lift_height` | `NormalLiftHeight` | x | - |
| `modes[].retract_second_dist` | 回程距離 | `motion.normal.retractDistance` | `Print.Retract Second Distance` | `modes[].retract_second_dist` | `retractSecondDistInputFile` | x | - |
| `modes[].base_peel_speed` | 底層抬升速度 | `motion.bottom.liftSpeed` | `Print.Bottom Lifting Speed` | `modes[].base_peel_speed` | `BasePeelSpeed` | x | - |
| `modes[].normal_peel_speed` | 抬升速度 | `motion.normal.liftSpeed` | `Print.Lifting Speed` | `modes[].normal_peel_speed` | `NormalPeelSpeed` | x | - |
| `modes[].base_return_speed` | 底層回程速度 | `motion.bottom.retractSpeed` | `Print.Bottom Retract Speed` | `modes[].base_return_speed` | `BaseReturnSpeed` | x | - |
| `modes[].normal_return_speed` | 回程速度 | `motion.normal.retractSpeed` | `Print.Normal Retract Speed` | `modes[].normal_return_speed` | `NormalReturnSpeed` | x | - |
| `modes[].bottom_lift_second_dist` | 底層二段抬升距離 | `motion.bottom.liftSecondDistance` | `Print.Bottom Lifting Second Distance` | `modes[].bottom_lift_second_dist` | `bottomLiftSecondDistInputFile` | x | - |
| `modes[].bottom_lift_second_speed` | 底層二段抬升速度 | `motion.bottom.liftSecondSpeed` | `Print.Bottom Lifting Second Speed` | `modes[].bottom_lift_second_speed` | `bottomLiftSecondSpeedInputFile` | x | - |
| `modes[].bottom_retract_second_speed` | 底層二段回程速度 | `motion.bottom.retractSecondSpeed` | `Print.Bottom Retract Second Speed` | `modes[].bottom_retract_second_speed` | `bottomRetractSecondSpeedInputFile` | x | - |
| `modes[].lift_second_dist` | 二段抬升距離 | `motion.normal.liftSecondDistance` | `Print.Lifting Second Distance` | `modes[].lift_second_dist` | `liftSecondDistInputFile` | x | - |
| `modes[].lift_second_speed` | 二段抬升速度 | `motion.normal.liftSecondSpeed` | `Print.Lifting Second Speed` | `modes[].lift_second_speed` | `liftSecondSpeedInputFile` | x | - |
| `modes[].retract_second_speed` | 二段回程速度 | `motion.normal.retractSecondSpeed` | `Print.Normal Retract Second Speed` | `modes[].retract_second_speed` | `retractSecondSpeedInputFile` | x | - |
| `modes[].light_pwm` | 光源 PWM | `advanced.lightPWM` | `Advanced.Light PWM` | `modes[].light_pwm` | `ligthPwmInputFile` | x | - |
| `modes[].bottom_light_pwm` | 底層光源 PWM | `advanced.bottomLightPWM` | `Advanced.Bottom Light PWM` | `modes[].bottom_light_pwm` | `bottomLigthPwmInputFile` | x | - |
| `modes[].grayscale_level` | 灰階等級 | `advanced.greyLevel` | `Advanced.Grey Level` | `modes[].grayscale_level` | `grayScaleLevelInputFile` | `gray_level` | - |
| `modes[].gcode.start` | 起始 Gcode | `gcode.start` | `Gcode.Start` | `modes[].gcode.start` | `GCODEStart` | x | - |
| `modes[].gcode.mid` | 層間 Gcode | `gcode.mid` | `Gcode.Interlayer` | `modes[].gcode.mid` | `GCODEMid` | x | - |
| `modes[].gcode.end` | 結束 Gcode | `gcode.end` | `Gcode.End` | `modes[].gcode.end` | `GCODEEnd` | x | - |
| `modes[].compensate_size.default.in` | 內補償 | `advanced.innerCompensate` | `Advanced.Inner Compensate` | `modes[].compensate_size.default.in` | `CompensateSize.Default.CompensateSizeIn` | x | - |
| `modes[].compensate_size.default.out` | 外補償 | `advanced.outerCompensate` | `Advanced.Outer Compensate` | `modes[].compensate_size.default.out` | `CompensateSize.Default.CompensateSizeOut` | x | - |
| `-` | - | `machine.resolution.x` | - | `profiles[].resolution.x` | `ResolutionX` | x | 匯出專用，不從 resin 載入 UI |
| `-` | - | `machine.resolution.y` | - | `profiles[].resolution.y` | `ResolutionY` | x | 匯出專用，不從 resin 載入 UI |
| `-` | - | `machine.bedSize.x` | - | `profiles[].dimensions.x` | `DimensionX` | x | 匯出專用，不從 resin 載入 UI |
| `-` | - | `machine.bedSize.y` | - | `profiles[].dimensions.y` | `DimensionY` | x | 匯出專用，不從 resin 載入 UI |
| `-` | - | `machine.zHeight` | - | `profiles[].dimensions.z` | `DimensionZ` | x | 匯出專用，不從 resin 載入 UI |
| `-` | - | `machine.mirror` | - | `profiles[].image_mirror` | `ImageMirror` | x | 匯出專用，不從 resin 載入 UI |
| `-` | - | `print.layerHeight` | - | `modes[].thickness_mm` | `Thickness` | x | 匯出專用；讀 UI 用 `cfg.thickness_mm` 而非 `mode.thickness_mm` |
| `-` | - | `print.layerHeight` 衍生 | - | `thickness_configs[].thickness_display` | `ThicknessName` | x | 匯出專用；重算為 `${Math.round(layerHeight * 1000)} um` |
| `-` | - | `print.layerHeight` | - | `profiles[].default_thickness` | `DefaultThickness.ThicknessValue` | x | 匯出專用；repo 內 resin JSON 沒有，但 exporter / parser 會處理 |
| `-` | - | `machine.name` | `Machine.Machine Name` | - | - | x | Machine-only；resin 端未接 UI 載入 |
| `-` | - | `machine.type` | `Machine.machine_type` | - | - | x | Machine-only；resin 端未接 UI 載入 |
| `-` | - | `machine.resolution.x` | `Machine.image_size[0]` | - | - | `display_pixels_x` | Machine-only |
| `-` | - | `machine.resolution.y` | `Machine.image_size[1]` | - | - | `display_pixels_y` | Machine-only |
| `-` | - | `machine.zHeight` | `Machine.machine_z` | - | - | x | Machine-only；resin 端未接 UI 載入 |
| `-` | - | `machine.bedSize.x` | `Machine.bed_size[2]` | - | - | `display_width` | Machine-only |
| `-` | - | `machine.bedSize.y` | `Machine.bed_size[3]` | - | - | `display_height` | Machine-only |
| `-` | - | `machine.mirror` | `Machine.Mirror` | - | - | x | Machine-only；resin 端未接 UI 載入 |
| `-` | - | `advanced.antialiasing` | `Advanced.Anti-aliasing` | - | - | `anti_aliasing` | UI-only |
| `-` | - | `advanced.antialiasingLevel` | `Advanced.Anti-aliasing Level` | - | - | `anti_aliasing_level` | UI 顯示 2/4/8；後端 0/1/2 |
| `-` | - | `advanced.imageBlurEnable` | `Advanced.Image Blur` | - | - | - | 布林；匯出值為 `antialiasing && imageBlurEnable`；AA 關 → false |
| `-` | - | `advanced.imageBlurPixel` | `Advanced.Image Blur Pixel` | - | - | `blur` | UI 2–8；後端 1–7（UI−1）；blur = imageBlur ? pixel : 0 |
| `profiles[].brand_name` | - | - | - | `profiles[].brand_name` | `BrandName` | x | 不進 UI；保留原值，fallback 填 `Imported` |
| `profiles[].printer_brand` | - | - | - | `profiles[].printer_brand` | `PrinterBrand` | x | 不進 UI；保留原值，fallback 用 `machine.type` |
| `profiles[].printer_name` | - | - | - | `profiles[].printer_name` | `PrinterName` | x | 不進 UI；保留原值，fallback 用 `machine.name` / `defaultJson` 推導 |
| `profiles[].export_type` | - | - | - | `profiles[].export_type` | `ExportType` | x | 不進 UI；保留原值，fallback 由 `defaultJson.Other.export_file_type` 推導 |
| `profiles[].margin_buffer.x` | - | - | - | `profiles[].margin_buffer.x` | `MarginBufferX` | x | 不進 UI；保留原值，匯出時不依 UI 更新 |
| `profiles[].margin_buffer.y` | - | - | - | `profiles[].margin_buffer.y` | `MarginBufferY` | x | 不進 UI；保留原值，匯出時不依 UI 更新 |
| `profiles[].add_by_user` | - | - | - | `profiles[].add_by_user` | `AddByUser` | x | 不進 UI；repo 內 resin JSON 沒有，XML parser / fallback 會處理 |
| `profiles[].resin_color.r` | - | - | - | `profiles[].resin_color.r` | `ResinColorR` | x | 不進 UI；repo 內 resin JSON 沒有，XML parser / fallback 會處理 |
| `profiles[].resin_color.g` | - | - | - | `profiles[].resin_color.g` | `ResinColorG` | x | 不進 UI；repo 內 resin JSON 沒有，XML parser / fallback 會處理 |
| `profiles[].resin_color.b` | - | - | - | `profiles[].resin_color.b` | `ResinColorB` | x | 不進 UI；repo 內 resin JSON 沒有，XML parser / fallback 會處理 |
| `thickness_configs[].compensate_mode` | - | - | - | `thickness_configs[].compensate_mode` | `CompensateMode` | x | 不進 UI；保留原值，fallback 固定 `0` |
| `modes[].mode` | - | - | - | `modes[].mode` | `ExposureData.ThicknessName` | x | 不進 UI；用於選擇 mode |
| `modes[].ratio.x` | - | - | - | `modes[].ratio.x` | `RatioX` | x | 不進 UI；保留原值，fallback 固定 `1` |
| `modes[].ratio.y` | - | - | - | `modes[].ratio.y` | `RatioY` | x | 不進 UI；保留原值，fallback 固定 `1` |
| `modes[].ratio.z` | - | - | - | `modes[].ratio.z` | `RatioZ` | x | 不進 UI；保留原值，fallback 固定 `1` |
| `modes[].two_stage` | - | - | - | `modes[].two_stage` | `TwoStage` | x | 不進 UI；保留原值，fallback 固定 `0` |
| `modes[].bottom_retract_dist` | - | - | - | `modes[].bottom_retract_dist` | `bottomRetractDistInputFile` | x | 不進 UI；`fromResin()` 忽略，匯出固定寫 `0` |
| `modes[].retract_dist` | - | - | - | `modes[].retract_dist` | `retractDistInputFile` | x | 不進 UI；`fromResin()` 忽略，匯出固定寫 `0` |
| `modes[].rotate_para` | - | - | - | `modes[].rotate_para` | `RotatePara` | x | 不進 UI；保留原值，fallback 固定 `0` |
| `modes[].timelapse.enabled` | - | - | - | `modes[].timelapse.enabled` | `timeLapseSwitchFile` | x | 不進 UI；保留原值，fallback 固定 `0` |
| `modes[].timelapse.interval_layers` | - | - | - | `modes[].timelapse.interval_layers` | `timeLapseIntervalLayersFile` | x | 不進 UI；保留原值，fallback 固定 `1` |
| `modes[].timelapse.move_speed` | - | - | - | `modes[].timelapse.move_speed` | `timeLapseMoveSpeedFile` | x | 不進 UI；保留原值，fallback 固定 `0` |
| `modes[].exposure_delay_mode` | - | - | - | `modes[].exposure_delay_mode` | `exposureDelayModeFile` | x | 不進 UI；保留原值，fallback 固定 `0` |
| `modes[].turn_off_time` | - | - | - | `modes[].turn_off_time` | `turnOffTimeInputFile` | x | 不進 UI；`fromResin()` 忽略，匯出固定寫 `0` |
| `modes[].advance_mode` | - | - | - | `modes[].advance_mode` | `advanceModeFile` | x | 不進 UI；保留原值，fallback 固定 `0` |
| `modes[].compensate_size.default.in_base` | - | - | - | `modes[].compensate_size.default.in_base` | `CompensateSize.Default.CompensateSizeInBase` | x | 不進 UI；保留原值，fallback 固定 `0` |
| `modes[].compensate_size.default.out_base` | - | - | - | `modes[].compensate_size.default.out_base` | `CompensateSize.Default.CompensateSizeOutBase` | x | 不進 UI；保留原值，fallback 固定 `0` |
| `modes[].compensate_size.customize.in` | - | - | - | `modes[].compensate_size.customize.in` | `CompensateSize.Customize.CompensateSizeIn` | x | 不進 UI；保留原值，fallback 固定 `0` |
| `modes[].compensate_size.customize.in_base` | - | - | - | `modes[].compensate_size.customize.in_base` | `CompensateSize.Customize.CompensateSizeInBase` | x | 不進 UI；保留原值，fallback 固定 `0` |
| `modes[].compensate_size.customize.out` | - | - | - | `modes[].compensate_size.customize.out` | `CompensateSize.Customize.CompensateSizeOut` | x | 不進 UI；保留原值，fallback 固定 `0` |
| `modes[].compensate_size.customize.out_base` | - | - | - | `modes[].compensate_size.customize.out_base` | `CompensateSize.Customize.CompensateSizeOutBase` | x | 不進 UI；保留原值，fallback 固定 `0` |
| `profiles[].dimensions` | - | - | - | - | - | x | 不進 UI；結構容器，實際處理 `dimensions.x` / `y` / `z` |
| `profiles[].resolution` | - | - | - | - | - | x | 不進 UI；結構容器，實際處理 `resolution.x` / `y` |
| `profiles[].margin_buffer` | - | - | - | - | - | x | 不進 UI；結構容器，實際處理 `margin_buffer.x` / `y` |
| `profiles[].thickness_configs` | - | - | - | - | - | x | 不進 UI；結構容器，實際處理 `thickness_configs[].*` |
| `profiles[].resin_color` | - | - | - | - | - | x | 不進 UI；結構容器，實際處理 `resin_color.r` / `g` / `b` |
| `thickness_configs[].modes` | - | - | - | - | - | x | 不進 UI；結構容器，實際處理 `modes[].*` |
| `modes[].ratio` | - | - | - | - | - | x | 不進 UI；結構容器，實際處理 `ratio.x` / `y` / `z` |
| `modes[].timelapse` | - | - | - | - | - | x | 不進 UI；結構容器，實際處理 `timelapse.*` |
| `modes[].gcode` | - | - | - | - | - | x | 不進 UI；結構容器，實際處理 `gcode.start` / `mid` / `end` |
| `modes[].compensate_size` | - | - | - | - | - | x | 不進 UI；結構容器，實際處理 `compensate_size.default.*` / `customize.*` |

## 目前重要例外

### 1. Gcode key 以實際 JSON key 為準

- `Gcode.Start`
- `Gcode.Interlayer`
- `Gcode.End`

### 2. Bottom before/after lift 僅保留 machine mirror

- UI 不再有獨立 bottom before-lift / after-lift 欄位
- Resin 匯入與匯出不再使用 dedicated bottom wait keys
- Machine 匯出仍保留：
  - `print.restBeforeLift` → `Print.Bottom Rest Before Lift`
  - `print.restAfterLift` → `Print.Bottom Rest After Lift`

### 4. retract distance 只看 second distance

- `motion.normal.retractDistance` ← `retract_second_dist`
- `motion.bottom.retractDistance` ← `bottom_retract_second_dist`
- `retract_dist`、`bottom_retract_dist` 不參與 UI 載入，匯出固定 `0`

### 5. `turn_off_time` 不參與 UI 載入

- `fromResin()` 不讀 `turn_off_time`
- `createFallbackResinProfile()` 會輸出 `turn_off_time: 0`
- `buildExposureDataXml()` 會輸出 `<turnOffTimeInputFile>`

### 6. `imageBlurPixel` / `antialiasingLevel` 顯示值與後端對照

- `uiParams`（schema v2）儲存 **UI 顯示值**；`defaultToUi` / `uiToDefault` / `uiToBackendSlicing` 透過 `mappingTables.transforms` 換算（命名同 `mmPerMinToMmPerSec`：`antiAliasingLevelBackendToUi`、`imageBlurPixelUiToBackend` 等）。
- **AA**：UI `2 | 4 | 8` ↔ 後端 `anti_aliasing_level` `0 | 1 | 2`（Prusa 內部再映射 2x/4x/8x）。
- **Blur**：`imageBlurEnable`（來自 `Advanced.Image Blur`）+ `imageBlurPixel`（UI `2–8` ↔ 後端 `1–7`）分離儲存。需啟用 AA 才顯示 enable；勾選 enable 才顯示 pixel（`<Select>` 選項 2–8）。
- 匯出時：`Advanced.Image Blur = antialiasing && imageBlurEnable`；`blur = imageBlur ? imageBlurPixel−1 : 0`。
