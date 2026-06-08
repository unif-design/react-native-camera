# 相机拍照体验优化 + 全面向 design 看齐 + 工程规范化

- 日期:2026-06-08
- 仓库:`@unif/react-native-camera`(+ 联动改 `@unif/react-native-design`)
- 状态:待用户 review

## 背景与目标

用户在真机使用中提出 7 项拍照体验问题。排查时发现三个更底层的问题,一并纳入本次:

1. **图标未统一在 design**:`VolumeIcon` 是 camera 自绘 SVG,违背"图标统一在 design"原则。
2. **依赖/文档过时**:camera 仍把 `@gorhom/bottom-sheet` 当必装 peer,但 design 0.6 起已彻底移除;camera 装的还是旧版 design 0.5.1(最新 0.7.0)。
3. **命令式弹窗被相机 Modal 盖住**:相机是 RN `<Modal>`,而 `confirm()`/`toast()` 的 host 挂在 App 根,RN 里根部 Modal 无法叠在已 present 的相机 Modal 之上 → 相机内的确认/删除/放弃弹窗和 toast 全被盖住(点 7、点 4 同源)。

此外用户要求把 **暗色主题** 从 camera 硬编码的 `colors/dark.ts` 迁到 design 主题 token,并把测试 **统一到 `src/__tests__/`**。

**目标**:修复 7 项体验问题;图标、颜色全面向 design 看齐;清理过时依赖与文档;测试规范化。

## 已对齐的关键决策

| 项 | 决策 |
|---|---|
| 取景布局(点1) | 取景画面**整屏垂直居中**,`sideRail`/`zoomChips`/`footer` 改 absolute 浮层,footer 底部加半透明保护 |
| 比例切换(点2) | 图标 → 文字 `4:3` / `16:9` |
| 静音图标(点3) | design 新增 `sound-off`,camera 删 `VolumeIcon` 改用 design `Icon` |
| 预览背景(点4) | 与点7同源;本地确认弹窗自带 `rgba(0,0,0,0.5)` 遮罩;看图的整页预览仍黑底 |
| 0.5x(点5) | 启用 `ultra-wide-angle`,**需真机验证不触发 iOS #3773** |
| 网格(点6) | 彻底删除(按钮 + GridOverlay + state/props) |
| 弹窗层级(点7) | 相机内**自带本地确认弹窗 + 本地 toast**,不走 design 全局 host;消费者不再需要为相机挂 ConfirmHost/ToastHost |
| 图标归位 | camera 不自绘图标;`FocusIndicator`(对焦动画,非图标)保留在 camera |
| 暗色主题 | **务实迁移**:能对应的全用 design dark token(`forceScheme="dark"` + `useColors()`);仅保留极少相机物理常量(纯黑取景底 / 控件玻璃黑底 / 录制红),明确注释 |
| 依赖 | 升 design(到含 sound-off 的新版)、移除 `@gorhom/bottom-sheet`、文档全量更新 |
| 测试 | 统一到 `src/__tests__/`,镜像源码结构 |
| 发布协调 | design 走**新分支 → PR → 合并 → 删分支 → 发版**,再做 camera 开发 |

## Phase A — design 仓库:新增 `sound-off` 图标(PR 流程)

> design 路径:`/Users/liulijun/tongyi/unif/react-native-design`
> 暗色主题选"务实迁移",design **无需补色板 token**,Phase A 只含图标。

1. 新分支(如 `feat/add-sound-off-icon`)。
2. 新增 `src/icons/svg/sound-off.svg`:喇叭主体沿用 `sound`(`M11 5L6 9H3v6h3l5 4V5z`),右侧用两条交叉线组成完整 `✕`(落在 viewBox `0 0 24 24` 安全区内),`stroke="currentColor"` / `stroke-width="1.75"` / round,风格与 `sound` 一致。
3. 跑 `node scripts/build-icons.js` 重新生成 `src/icons/data.ts`(应出现 `sound-off`)。
4. 校验:`yarn typecheck`(`IconName` 含 `sound-off`)、`yarn lint`。
5. `yarn prepare`(bob build)产出 lib。
6. commit + push + 开 PR;**合并由用户操作**(或用户授权后我用 `gh` 合并),合并后删分支。
7. 用户执行 `yarn release` 发版;**回填发布版本号到本 spec 与 camera 依赖范围**。

**验收**:`Icon name="sound-off"` 在 design 可用,与 `sound` 视觉成对。

## Phase B — camera 仓库

> 依赖 Phase A 发版完成(仅"静音图标接入"这一步强依赖;其余可先行)。

### B0. 依赖现代化

- `package.json`:
  - peer `@unif/react-native-design` `>=0.4.0` → **含 sound-off 的版本**(回填);devDep `0.5.1` → 同版本。
  - **删** peer(L120)+ devDep(L76)里的 `@gorhom/bottom-sheet`。
- `example/package.json`:删 `@gorhom/bottom-sheet`(L13);design 同步到新版。
- `jest.setup.ts`:删 `BottomSheet` mock(L114,0.7 不再需要)。
- `yarn` 重新安装锁定。

### B1. 取景画面整屏居中(点1)

- **现状**:`Container` 为 `column[viewport(flex:1, center), bottom]`,取景框在 viewport(footer 之上区域)内居中 → 相对整屏偏上(真机已确认:画面贴状态栏、底部一大块黑)。
- **改法**:取景器铺满整个 `root`,取景框相对**整屏**垂直居中;`sideRail` / `zoomChips` / `footer` 改为 absolute 浮层叠在取景之上;footer 容器加半透明黑底(`rgba` 或 design `scrim`/`sheetBackdrop` 衍生)保证浮层控件可读,不引入新的渐变依赖。
- **文件**:`src/camera/Container.tsx`(布局重构)、`src/camera/Camera.tsx`(`root`/`frame` 适配 absoluteFill 居中)。
- **注**:若真机上 footer 浮层遮挡 16:9 画面过多,微调 footer 半透明强度/高度。

### B2. 比例切换改文字(点2)

- **现状**:`SideRail` 用 `Icon name={aspect-4-3 / aspect-16-9}`。
- **改法**:换成文字按钮 `4:3` / `16:9`(用 design 文本 token / `Text`)。
- **文件**:`src/camera/setup/SideRail.tsx`。

### B3. 静音图标归位 design(点3)

- **现状**:自绘 `src/camera/icons/VolumeIcon.tsx`(on=声波,off=一条右端出界、像没画全的斜线)。
- **改法**:删 `VolumeIcon.tsx` 及其目录(若空);`SideRail` 改 `<Icon name={sound ? 'sound' : 'sound-off'} />`。
- **文件**:`src/camera/setup/SideRail.tsx`;删 `src/camera/icons/VolumeIcon.tsx`。
- **依赖**:Phase A 发版后。

### B4 & B7. 本地弹窗 + toast(点4 + 点7)

- **现状**:`Container`(切模式/放弃确认)、`PreviewOverlay`(删除确认 `confirm()`、"已保存" `toast`)走 design 全局 host → 被相机 RN Modal 盖住。
- **改法**:相机 Modal 内部自带本地弹窗系统,不走 design 全局 `confirm`/`toast`:
  - 新增 `src/camera/ui/CameraDialogHost.tsx`:Context Provider,内部渲染本地确认弹窗(absolute overlay,**非** RN Modal——已在相机 Modal 内,用高 zIndex `absoluteFill` + `rgba(0,0,0,0.5)` 遮罩 + 底部 sheet,复用 design `Button` + dark token)和本地 toast(底部短提示),暴露 `{ confirm, toast }`。
  - 挂在 `ModalView` 内(相机 Modal 子树顶层)。
  - `Container` / `PreviewOverlay` 改用 `useCameraDialog()` 的 `confirm`/`toast`,不再 import design 的 `confirm`/`toast`。
- **文件**:新增 `src/camera/ui/CameraDialogHost.tsx`;改 `src/camera/ModalView.tsx`、`src/camera/Container.tsx`、`src/camera/preview/PreviewOverlay.tsx`。
- **副作用**:`CLAUDE.md` 删除"消费者必须挂 ConfirmHost/ToastHost"(相机不再依赖);看图的整页 `PreviewOverlay` 保持黑底。

### B5. 启用 0.5x 超广角(点5)

- **现状**:`useCameraDevice(position, { physicalDevices: ['wide-angle'] })`(规避 iOS #3773),无 0.5x。
- **改法**:`physicalDevices: ['ultra-wide-angle', 'wide-angle']`;`ZoomChips` 已有 0.5 档过滤逻辑会自动出现。
- **文件**:`src/camera/Container.tsx`。
- **风险**:**需用户真机验证**前后摄切换 + 0.5x 不触发 #3773;若复现,回退或加设备能力判断。

### B6. 删除网格(点6)

- **改法**:删 `SideRail` 网格按钮、`Camera.tsx` 的 `GridOverlay` 及 `grid` prop、`Container` 的 `grid` state 与传参。
- **文件**:`src/camera/setup/SideRail.tsx`、`src/camera/Camera.tsx`、`src/camera/Container.tsx`。

### B8. 暗色主题向 design 看齐(务实迁移)

- **现状**:`src/camera/colors/dark.ts` 硬编码整套 `DARK`,全库 import。
- **改法**:
  - `ModalView` 的 `ThemeProvider` 加 `forceScheme="dark"`。
  - 相机内用 design `useColors()` / `darkColors`:橙→`primary`(值完全一致 `#EB6E00`)、白前景→`foreground`、半透明白边框/高亮→`glassPillBorder`/`glassHighlight`/`glassSeparator`、遮罩→`scrim`/`sheetBackdrop` 等。
  - `colors/dark.ts` 精简为**相机物理常量**(改名如 `viewfinder.ts` 或保留文件但只留 3 项 + 明确注释):纯黑取景底 `#000`、控件玻璃黑底(`rgba(0,0,0,0.42/0.45)`,浮在明亮画面上才看得清,design glass 是白底不适用)、录制红 `#ff3b30`(iOS 标准,design `error` 语义不同)。
- **文件**:`src/camera/ModalView.tsx` 及所有 import `DARK` 的组件;`src/camera/colors/dark.ts`。

### B9. 测试统一到 `src/__tests__/`(镜像结构)

- **改法**:22 个 colocate 测试迁入 `src/__tests__/`,镜像源码路径(如 `src/camera/footer/ActionRow.test.tsx` → `src/__tests__/camera/footer/ActionRow.test.tsx`);跨模块的(`contract`/`types`/`viewfinder`/`mock`)留 `src/__tests__/` 根,`useCamera`/`useCreation`→`__tests__/hooks/`、`util`→`__tests__/utils/`。迁移后修正各测试相对 import 路径。
- **因重构增删的测试**:
  - 删 `VolumeIcon.test`(组件删除)。
  - 改/删 `colors/dark.test`(dark.ts 精简)。
  - 改 `SideRail.test`(去 grid 按钮、aspect 改文字、sound 用 design Icon)。
  - 改 `Camera` 相关(去 GridOverlay)。
  - 新增:`CameraDialogHost` 本地弹窗/ toast 行为测试;`ZoomChips` 0.5 档测试(若缺);取景居中布局测试(可选)。
- **文件**:`jest` 配置如需(roots/testMatch)同步;`CLAUDE.md` 测试约定更新。

### B10. 文档全量更新

- `CLAUDE.md`:peers 清单去 `@gorhom/bottom-sheet`;删"必须挂 ConfirmHost/ToastHost";测试约定改为"统一 `src/__tests__/`";图标统一 design;暗色用 design token;网格已移除;0.5x 说明。
- `README.md`:安装命令去 bottom-sheet。
- `AGENTS.md`:如涉及同步。
- `website/docs/getting-started/installation.md`(命令 + 依赖表)+ `website/static/md` 副本:去 bottom-sheet;`docusaurus.config.ts` / `rn-globals.ts` 的 bottom-sheet 注释举例按需更新。
- 改完跑 `yarn workspace website build:llms` 重生成 `llms.txt` / `llms-full.txt`。

## 测试与验证

- camera:`yarn typecheck` + `yarn lint` + `yarn test` 全绿。
- design(Phase A):`yarn typecheck` + `yarn lint` + `yarn prepare`。
- **真机(用户)**:点1 取景居中观感、点5 0.5x + 前后摄不崩、点7 弹窗可见、整体暗色一致。

## 风险与顺序依赖

1. **顺序**:Phase A(design 发版)→ B3 静音图标接入。B0/B1/B2/B4/B5/B6/B8/B9/B10 不依赖 Phase A,可先行(B3 留到发版后接入 + 跑通 typecheck)。
2. **design 0.5→新版其它 break**:升级后若 `Icon`/`useColors`/`Button` 等 API 有变,一并适配。
3. **iOS #3773**:0.5x 仅能真机验证,我无法本地跑。
4. **footer 浮层遮挡**:16:9 画面较高,浮层强度需真机微调。

## 验收标准

- 7 项体验问题在真机消失;相机内无自绘图标;无 `@gorhom/bottom-sheet` 残留(代码/依赖/文档);暗色全走 design token + 极少注释清楚的物理常量;测试全在 `src/__tests__/` 且全绿;`llms.txt` 已重生成。
