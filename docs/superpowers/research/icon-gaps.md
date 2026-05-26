# Camera 仓库需要但 design 仓库缺失的 icons

整理时间：2026-05-26（Phase 2 全量改造期）

design 仓库当前已收纳的 svg 在 `src/icons/svg/`（99 个），下面是 camera 仓库改造时识别出的、需要但当前缺失的相机专属 icon。

## 缺失清单

- `shutter`：圆形快门按钮主图标（用于代替 Footer 内自定义 `<TouchableOpacity>` 圆形快门，目前临时保留自定义实现 + 红底标识录制态）。
- `shutter-recording` / `record-stop`：录制中的快门内部小方块，传统相机 UX 一组成对。
- `flash-on`、`flash-off`、`flash-auto`：闪光灯 3 个状态切换图标（当前 SetUp 用文案 chip 替代，理想方案是 icon-only chip）。
- `aspect-4-3`、`aspect-16-9`：画幅切换图标（当前用文案 chip，理想方案是 icon-only chip）。
- `lens-flip` / `lens-toggle`：广角 ↔ 长焦镜头切换（当前 SetUp 用倍数文案 chip）。
- `camera-flip` / `camera-switch`：前后摄切换（目前 Container 只用了后置摄，未来如需要前置摄需要此 icon）。
- `camera-off` / `camera-disabled`：NoCamera 空态主插画（当前 Empty 用默认 `spark` 插画，语义不直观）。
- `video-record` / `video-stop`：视频模式专属指示器（区别于 shutter）。
- `permission-denied` / `lock-camera`：NoPermission 空态主插画（替代 `spark`，更贴合「权限被拒」语义）。
- `error-alert` 强调态：Error 空态希望比 spark 更直接表达「出错了」（design 已有 `alert.svg`，但 `Empty` 组件目前 hard-code 用 `spark`，要么补充 Empty.iconName 入参，要么补一组「分类化空态插画」）。

## 期望（Phase 3 跟 design 仓库对齐）

1. 上述 ~10 个 icon 补齐到 `react-native-design/src/icons/svg/`。
2. `Empty` 组件接受可选 `icon?: IconName` prop（默认仍是 `spark`），允许相机这类业务自定义。
3. 文案 chip → icon chip 迁移，进一步提升 SetUp 工具栏的可识别度。
