# AGENTS.md
<!-- BEGIN UNIF REACT NATIVE STANDARD -->

## 共享标准启动

你维护的仓库是 `react-native-camera`。本区块只负责启动与失效保护;完整共享流程由
`rn-library` Skill 管理,marker 外只保存本仓特有规则。

开始任何任务前:

1. 运行 `git status --short --branch`;位于 `main` 时,在首次写入前创建语义明确的任务分支。
2. 保留已有改动,不得覆盖、暂存或提交与当前任务无关的文件。
3. 查找并读取 `rn-library` 与 `camera` Skill,两者叠加使用。
4. Skill 缺失时,按当前 Agent 选择一条全局安装命令:

```sh
# Codex
npx skills add unif-design/skills --skill rn-library --skill camera --global --agent codex --yes

# Claude Code
npx skills add unif-design/skills --skill rn-library --skill camera --global --agent claude-code --yes
```

安装完成后重新读取两个 Skill。安装失败、需要认证或仍无法读取时停止修改并报告,不得跳过
共享门禁。仓库正文只能补充或收紧共享规则;发现真实冲突时如实报告。

<!-- END UNIF REACT NATIVE STANDARD -->

## 仓库定位

`@unif/react-native-camera` —— 基于 [react-native-vision-camera](https://github.com/mrousavy/react-native-vision-camera) 5.x 封装的**弹窗式相机**:单拍 / 连拍 / 录像 / 双指 pinch 变焦(+0.5/1 档位)/ 镜头翻转 / 点击对焦 / Skia 水印。目标运行时:**RN 0.85 新架构**(Fabric + Nitro Modules)、React 19、TypeScript 6。

**纯 JS 库**(无 `android/` `ios/` `cpp/` 原生源码) —— 原生能力全部来自 peerDependencies(vision-camera / nitro / skia / fs / video),本库只编排 JS/TS。`package.json#files` 里列了 `android/ios/cpp/*.podspec` 是模板的防御性写法,实际不打进包。

yarn workspaces 单仓库:库本体在根目录,`example/` 是宿主 RN app,通过 `react-native-monorepo-config` 接 Metro 直读根 `src/`,所以改库的 JS 代码在 example 里热更新,不用重新构建原生。`website/` 是 Docusaurus 文档站(同为 workspace)。

## 常用命令

除非另注,命令都在仓库根目录执行。

```sh
yarn                  # 安装(yarn 4.11,node v24.13,见 .nvmrc)
yarn typecheck        # tsc(noEmit,strict + noUncheckedIndexedAccess)
yarn lint             # eslint **/*.{js,ts,tsx}
yarn lint --fix       # 自动修复
yarn test             # jest(跑 src/__tests__/ 下 *.test.{ts,tsx},镜像源码结构)
yarn test src/__tests__/useCamera.test.tsx   # 跑单文件
yarn test -t "pattern"                        # 按测试名过滤
yarn prepare          # react-native-builder-bob → lib/module + lib/typescript
yarn clean            # 清 lib/ + example 构建产物

# example 宿主应用(相机要真机,见「关键坑」)
yarn example start    # metro
yarn example ios      # 构建并跑 iOS
yarn example android  # 构建并跑 Android

# 文档站(改 website/docs 后)
yarn workspace @unif/react-native-camera-website build:llms   # 重生成 llms.txt / llms-full.txt(docs 是其唯一来源)
```

**只用 yarn** —— 项目依赖 yarn workspaces(`packageManager: yarn@4.11.0`)。pre-commit hook(lefthook)对 staged 文件跑 `eslint` + `tsc`;commit-msg 用 commitlint 强校验 conventional commits。

## 架构与约定

改哪看哪:改公开 API → 看「对外暴露」;改交互流 → 「弹窗式相机」;判结果 → 「Result codes」;动水印 / 弹窗 / 图标主题取景 → 看对应节。

### 对外暴露(`src/index.tsx`)

整个库的公开面**只有一个 Hook**,外加类型/纯工具的 barrel:

```
useCamera()        # 唯一入口(src/hooks/useCamera.tsx)
./utils            # 类型(interface.ts:OpenConfig/CameraResult/CustomPhotoFile…)+ toFileUri / buildPhotoFile / depsAreSame / pxToDp
```

消费者**永远不直接碰** vision-camera 的 `<Camera>` —— 取景器、预览、footer、水印全在 `src/camera/` 内部,不导出。

### 弹窗式相机(核心心智)

- **`useCamera()` 无参** → 返回 `[api, holder]`。`api: { open(config): Promise<CameraResult>; close(): void }`。
- **`holder` 是相机模态的 React 宿主节点,必须渲染进树**(位置不限,但节点要存在)。缺少 holder 时 Modal 不会挂载,有效 `open()` 返回的 Promise 也无法由 `Container` 完成。
- **`api.open(config)` 先在 Hook 边界校验配置**(`validateOpenConfig.ts`)。非法配置直接 resolve `{code: 500, data: [], message: 'invalid_config'}`,不分配 session、不关闭或替换已经打开的有效 session;合法配置会深拷贝 `cameraMode[]`、每个 mode、watermark 与 `content[]`,消费者后续修改原对象不会改变本次 session。
- **每个合法 `open()` 都有单调递增的 session ID**。第二次合法 `open()` 先以 `code: 0` 完成旧 Promise,再安装新 session;`finish(sessionId, result)` 同时校验 ID 与 active status,所以保存、关闭、卸载和旧 Container 晚到 callback 只能有一个结果。`api.close()` 与 Hook 卸载同样以取消完成 active Promise。`ModalView` 自带 `SafeAreaProvider` + `ThemeProvider`,模态内 UI 不依赖宿主 provider。
- **配置全在 `OpenConfig`**(`src/utils/interface.ts`,改 API 先看这里):
  - `cameraMode: CameraMode[]` —— 每项 `{ mode: 'single' | 'continuous' | 'video', quality?, type?, flashMode?, recTime? }`。`type` 接线为初始前/后摄(首项生效);`flashMode` 接线为初始闪光(首项生效);`recTime` 接线为 vision-camera `maxDuration`(秒):到点原生自动停、视频自动入已拍列表(缺省不设=不自动停)。`quality` = JPEG 压缩 0~1,缺省 0.9。
  - `dataRetainedMode: 'clear' | 'retain'` —— 用户切换拍摄模式时已拍文件:`clear` 先二次确认(相机内本地 `confirm`,见下)再清空、且「单拍 + clear」拍完直接进确认预览;`retain` 累积不清。
  - `watermark?: WatermarkType` —— 见下。
  - **拍摄质量(三个可选,全局)** —— `photoQualityPrioritization?: 'speed'|'balanced'|'quality'` / `photoHDR?: boolean` / `videoBitRate?: number`。**核心约定:缺省(不传)= 库不写入任何偏好,完全走 SDK 默认协商**(不替消费者写死取舍);只有显式传值才下发。`'speed'` 在不支持的设备**自动安全降级**为 `'balanced'`(不 throw);`'quality'`/`'balanced'` 任何设备直传(质量优先与 speed 能力位无关,见 `Camera.tsx` guard)。**与分辨率无关**:照片/录像分辨率已固定 UHD(见下「画幅」),不随这三字段变。

### Result codes(`CameraResult.code`,`useCamera.tsx` + `Container.tsx`)

判成功务必 `code === 200`,别把 `0`(取消)当成功 —— 取消 / 失败时 `data` 为空。

| code | 含义 | `data` |
| --- | --- | --- |
| `200` | **成功(唯一成功码)** | `CustomPhotoFile[]` |
| `0` | 取消 / 关闭 | 空 |
| `403` | Camera 权限被拒 | 空 |
| `404` | 当前选择方向无可用相机设备 | 空 |
| `500` | `OpenConfig` runtime 校验失败(`invalid_config`) | 空 |
| `503` | 录像失败(保留码,当前不触发,见下) | 空 |

> **拍照 / 录像 runtime 失败不 settle 关相机**:快门失败、录像启动 / 停止失败走顶部错误条,保留 session 与此前文件。`500` 只用于 `open()` 边界的配置校验;校验覆盖非空 `cameraMode`、所有公开 enum、`quality` 的 finite `0...1`、`recTime` / `videoBitRate` 的 finite 正数、boolean 字段及 watermark shape。空 watermark content 合法。`Container` 的 `currentMode == null` 分支只是防御兜底,不是正常的校验入口;native、录像或照片处理错误不得复用 `500`。`503` 只保留兼容 code,当前无生产触发路径。

### 照片处理 / Skia 水印(`src/camera/image/` + `src/camera/watermark/`)

- `WatermarkType`:`content: string[]`(每项一行,第 0 行加粗)+ `position`(六选一,缺省 `'top-right'`)。
- **`usePhotoCaptureTransaction` 已接入 `processPhoto()`**:native capture 一返回 raw path 就先登记 session 所有权;JPEG 在 16:9 或存在可见水印时进入 processor,其余无需处理的输出才直接交付 normalized raw。
- **原子 processor 契约**:`processPhoto()` 会快照 session / capture ID、画幅、quality、watermark 与实际 camera position;裁切 + 水印只做一次 decode / draw / JPEG encode,quality 使用当前 mode。处理失败会清理 raw 与可能存在的部分输出,再抛出 `.code === 'photo_processing_failed'` 的 `PhotoProcessingError`,绝不返回未满足请求的照片。
- **失败不降级交付 raw**:当前 operation 会回到可拍状态并显示「照片处理失败,请重试」,此前 files 保持不变;stale operation 只做 owned file 清理,不更新 UI。录像不进入照片 processor。
- Skia Data、Image、Surface、Paint、Paragraph Builder / Paragraph 与 Snapshot 都是 native 包装对象;所有成功 / 失败路径必须按依赖逆序 dispose,单个 dispose 失败不能遮蔽原错误或阻断其余清理。

### 与 `@unif/react-native-design` 的耦合(peer `>=0.20.0`)

design 是必装 peer,本库从它取这些(不自造):

| 取什么 | 用途 |
| --- | --- |
| `Button` / `Icon` | UI 与图标(图标全用 design,不自绘,详见「图标」) |
| `useColors` | 暗色 token |
| `type` / `t.*` · `fw` | 字号语义 token · 字重 |
| `r()` | 缩放 |
| `ThemeProvider` | `ModalView` 套 `forceScheme="dark"` 强制深色 |

**弹窗 / toast 走相机内部,不挂宿主 host**

- **实现** — `CameraDialogHost.tsx` → `useCameraDialog()`(`{ confirm, toast, showError }`),渲染在相机 Modal 子树内(`confirm`/`toast` 走底部弹窗·toast,`showError` 走**顶部非阻塞错误条**)
- **谁用** — `Container.tsx`(切模式 / 放弃拍摄的二次确认 + `onError`→`showError`)、`PreviewOverlay`(删除二次确认 + 「已保存」toast)
- **消费者** — 无需挂 `<ConfirmHost/>` / `<ToastHost/>`;改 dialog 只动这一个文件

> **为什么不复用 design 全局 host?**
> design host 挂 App 根 → 叠不到已 present 的相机 `<Modal>` → 被盖住。
> `CameraDialogHost` 改用 Modal 子树内高 zIndex overlay → 盖在相机上。

### 图标 / 主题 / 取景布局

改相机外观前先扫这些 UI 约定:

- **图标全用 design `Icon`,不自绘**(例:音量键 `name={sound ? 'sound' : 'sound-off'}`,`sound-off` 是本库给 design 加的)。**例外** `FocusIndicator`(点击对焦动画环)是动画图形,留 camera。
- **字体 / 颜色全走 design token** — 字号 `type` / `t.*`、字重 `fw`、颜色 `useColors()`;`ModalView` 套 `forceScheme="dark"` 恒深色。**例外** `src/camera/colors/viewfinder.ts` 几个 design 表达不了的**取景物理常量**(纯黑 letterbox、半透明黑玻璃药丸、iOS 录制红 + tint、水印阴影)。
- **取景整屏垂直居中** — 系统相机式:取景器铺满居中,控件浮层按 zIndex 叠其上。
- **画幅比例用文字按钮切换** — `4:3` / `16:9`(非图标,左侧竖栏 `SideRail`),**默认 `16:9`**(`useCameraSessionController` 初始 state)。**切画幅原生式(系统相机同款)**:photo 流**恒固定全幅 `UHD_4_3`**(不随画幅)→ photo outputs 恒定 → **切画幅 session 零重配、取景流不闪断**;取景 `resizeMode="cover"` + 取景框高度 `withTiming` 平滑伸缩 → 切换 = 预览画面平滑放大缩小(16:9 下 cover 裁左右 = 正确 16:9 视野)。**16:9 出图 = `processPhoto()` 拍后居中裁切**:`computeCropRect()` 计算区域,裁切与可见水印在同一个 Skia surface 完成;任一步失败都清理 owned 输出并提示重试,不会交付原图。**video 例外**:`targetResolution` 仍随画幅(视频无法拍后裁,video 模式切画幅会 session 重配,低频已接受)。高度动画 worklet 只读 SharedValue 数字,worklet 内绝不调 design `r()`(见下)。
- **闪光 / 声音用左侧竖栏切换** — 闪光三态**原地轮换**(点一下 auto→on→off→auto,**无弹出层**);声音开关 `name={sound ? 'sound' : 'sound-off'}`。capture 时 `flashMode` **全模式直传** vision-camera(我们的 `'auto'/'on'/'off'` 取值与其一致),仅 `device.hasFlash` guard(无物理闪光设备一律 `'off'`,否则 throw)。
- **预览页底部按钮** — 扫一扫式「上 icon 下文字」圆按钮:返回 `undo`、删除 `trash`(放大过、小尺寸糊)、重拍 `refresh`、保存 `check`;配色:返回 · 重拍 = 浅灰白,删除 = 橙,保存 = 红。
- **无网格** — 不提供九宫格构图叠加。

**变焦 = 双指 pinch 连续缩放 + 0.5/1 档位药丸**(`Camera.tsx` 的 `Gesture.Pinch` + `src/camera/footer/ZoomChips.tsx`):

- **双指 pinch 连续变焦**(`Camera.tsx` `Gesture.Pinch`,与点击对焦 `Gesture.Tap` 用 `Gesture.Simultaneous` 同时识别、互不阻断)。**SharedValue 直驱**:pinch 回调在 UI 线程直接写 `zoomShared`,vision-camera `zoom={zoomShared}` 直接消费 → **pinch 全程 0 次 JS setState**(早期每帧 `runOnJS(setZoom)` 整树重渲染卡顿,已根治);只 `onZoomEnd` 回写一次 JS 侧 `zoom`(供设备切换 clamp / 档位态)。倍数乘性:`scale=2`→倍数翻倍(pinch 手指间距天然乘性,无需对数曲线)。
- **0.5/1 档位药丸**(`ZoomChips`,点击跳档、高亮当前档;**高亮档文字实时显示倍数**,用 `createAnimatedComponent(TextInput)` + `useAnimatedProps` 写 `text`,同样 0 次 setState)。仅 `0.5` / `1` 两档(2x 已去掉),`0.5` 仅超广角机型显示。
- 软上限 **3x**(`useZoomController.ts` 的 `SOFT_MAX_DISPLAY`,display 空间)—— `device.maxZoom` 多镜头可达 ~123x,但 >3x 已是纯数字裁切、画质崩、不实用;pinch / 档位上限都派生自它(改上限只动这一处)。
- ⚠️ **worklet 内禁 design `r()`/`rf()`** —— pinch / 倍数文字 / 错误条动画都在 reanimated UI-runtime worklet 里跑;design 的 `r()` 是 JS(Remote)函数,在 worklet 里直接调会触发 worklets「同步调 Remote Function」**fatal**(2.15.1 切倍数崩、jest 测不到的红线)。必须先在 worklet 外把尺寸预算成数字常量,worklet 内只用值。
- 前置(`position==='front'`)无超广角 → **关 pinch(`enableZoom=false`)+ 不渲染档位药丸**(前摄定焦、无 0.5x);切回后置恢复。

**0.5x 超广角**(`Container.tsx` `physicalDevices: ['ultra-wide-angle', 'wide-angle']`;启用后须真机验证不复现 iOS #3773)。**「用户倍数」≠ vision-camera 的 `zoom`**:`zoom` 是 vzf(virtual-device zoom factor,相对最广镜头),用 `displayMul = 1 / device.zoomLensSwitchFactors[0]` 换算成用户倍数:

| 机型 | `switch0` | `displayMul` | vzf 1.0 | vzf 2.0 |
| --- | --- | --- | --- | --- |
| 后置带超广角 | 2 | 0.5 | 超广角 = 用户 **0.5x** | 广角 = 用户 **1x** |
| 前置 / 单广角 | 空 | 1(fallback) | — | — |

> **别用 `device.minZoom ≤ 0.5` 判 0.5x —— 错的。** `minZoom` 是 vzf,不是用户倍数。

### 拍摄编排 / 预览 / 生命周期(`Container.tsx` + `src/camera/hooks/`)

`Container.tsx` 是相机内 UI 总装,**生产交互状态由 reducer + 6 个 hook 驱动**(改交互流先定位到对应 hook,别在 Container 里堆):

- `usePermissionFlow` —— 权限态(`pending`/`granted`/`denied`);`denied`→`NoPermission`(code 403),`pending`→Loading。
- `useZoomController(device)` —— vzf↔display 推导 + `zoomShared` + 设备切换 clamp(见上「变焦」)。
- `useCameraSessionController` —— reducer、capabilities、operation token、configuration generation、预览 / 保存 / 取消与 exactly-once settle。
- `usePhotoCaptureTransaction` —— 拍照、原子处理、定格反馈、预览 / 删除 / 重拍与照片文件清理。
- `useVideoTransaction` —— native 录像 start / stop / cancel、时长采样、stale callback 门禁与视频文件清理。
- `useAppActive` —— App 前后台(切后台停取景,对齐官方 `isActive=appActive&&isScreenFocused`)。

#### 状态机接线边界

- **跨 session coordinator 已生效**:`useCamera.tsx` 负责 session ID、配置快照、supersede、exactly-once finish 与 stale callback 门禁。
- **Container 已注册 session controller 与 container presence bridge**:`registerContainer(sessionId)` 跟踪真实 mount / detach,`useCameraSessionController` 通过 `registerController` 暴露用户取消与强制 teardown。Modal back 走 controller capability / 录像确认;`close()`、supersede、真实 detach 与 unmount 会走强制收尾。
- **`useCameraSessionController` 已用 reducer 驱动** phase、capabilities、operation token 与 configuration generation;同步 shadow state 让同一 call stack 的重复操作立即被拒绝,async continuation 必须携带当前 token 才能提交。
- `nativeConfigurationKey` 排除 photo 画幅和相同 photo output 参数的 `single ↔ continuous`;device、photo / video output、photo quality / prioritization / HDR、video 画幅 / bitrate 会改变 key。reducer 只在 key 变化时递增 generation,Container 为 `Camera.onConfigured` 绑定当前 generation,只有最新 generation 能恢复 `ready`。

关键行为(都在 controller / transaction hooks / `Camera.tsx`):

- **快门防重入**(`beginPhoto()` 同步推进 controller shadow)—— React state 异步挡不住同帧连点;第二次 operation 会在 native capture 前被拒绝,UI 同时由 `capabilities.capture` 禁用快门,避免多个 UHD + Skia 事务并发导致内存峰值叠加。
- **`isActive = appActive && !photo.burning && preview == null`** —— 烧录或预览时停取景;预览 overlay 保留已配置的 Camera 实例,返回 / 重拍 / 删除末张后无需重新 attach / configure。
- **`onError` → 顶部非阻塞错误条,绝不关相机** —— `onError` 是「session 遇到任何错误」的诊断回调(`error` 是普通 Error、无 code 判致命性,且含重开/激活时 session 重启这类**可恢复**瞬时错误)。故只 `warn` + 冒泡给 Container 弹错误条(`useCameraDialog().showError`,带去抖 `ERROR_DEDUPE_MS`、4s 自动消失),**绝不据此 `settle(500)`**:早期无条件 settle 会把重开时的瞬时错误误当致命 → 第二次打开即报错关闭。
- **预览页两种 variant**(`PreviewOverlay`)—— `confirm`(单拍 clear 拍完即进、不分类 tab、显示全 files)/ `gallery`(累积多张、按 `cameraMode` 分类 tab,**单类型也显示其 tab**)。图片 `contain` + **固定灰画布**(`VIEWFINDER.previewCanvas` `#1C1C1E`)：外层容器恒定,只图片比例变 → 不同画幅外层观感一致。
- 镜头翻转图标 `camera-flip`(系统相机通用形态,比 `lens-flip` 直白);翻转直接切 `position`(无翻转动画,真机反馈奇怪故移除)。

### 临时文件与所有权

- **每个 session 都由 `useCamera()` 创建独立 `FileRegistry`**并传给照片 / 录像事务。native raw、processor final、已完成或 discarded 视频 path 都先登记为 `owned`,stale callback 才有权安全删除本 session 文件。
- registry 删除前同步标记 `deleted`,不先 `exists()`;单项 unlink 失败只告警。`replace()` 先登记 final 再删除 raw;删除、重拍、`clear` 切模式会清理对应 owned path,取消、supersede、真实 detach 与 unmount 会 `drain()` 其余 owned 文件。
- **成功 `code: 200` 前只 `transfer()` 返回文件**,随后 `drain()` 其余 owned path;transferred path 仍是临时文件,库不再删除。消费者需要长期保留时必须自行复制到持久目录。

## 关键坑

接入 / 改动时最容易踩的,前两个是最高频接入错误:

- **holder 必须渲染** —— 见上;最高频接入错误,缺它相机不弹且无报错。
- **只有 `200` 是成功** —— `0` 是取消;别把取消当成功(取消时 `data` 为空)。
- **peerDeps 必须装齐(缺一即崩)** —— 全部声明在 `package.json#peerDependencies`,以它为准。最易漏的两个:
  - `react-native-vision-camera-worklets`:vision-camera 5.x 把 Frame Processor 拆到这个同伴包并内部 `require`,即使本库不用 Frame Processor,Metro 静态解析仍会命中 → 缺它报 `Unable to resolve module react-native-vision-camera-worklets`。vision-camera 把它当可选 peer,本库已显式声明。
  - `@dr.pogodin/react-native-fs`(**不是** `react-native-fs`)—— `burnWatermark.ts` 用的是 dr.pogodin 这个 **fork**,装错成原始 `react-native-fs` 会冲突。
  - 其余实际用到的 peers:`react-native-nitro-modules` / `react-native-nitro-image` / `@shopify/react-native-skia` / `react-native-video`(7.x) / `react-native-reanimated`(4.x) / `react-native-worklets` / `react-native-reanimated-carousel` / `react-native-gesture-handler` / `react-native-safe-area-context` / `react-native-svg` / `@sbaiahmed1/react-native-blur` / `@unif/react-native-design`(`>=0.20.0`)。`@gorhom/bottom-sheet` **已不再是 peer**(design 0.6 起改纯 RN Modal、本库 `src` 本就没直接用,已移除)。
  - `package.json#peerDependencies` 另声明了 `react-native-webview`(历史保留,`src` 未直接引用),并含 `react` / `react-native`;**完整清单以 `package.json` 为准,以上仅列运行时实际依赖的包**。
- **升级 native peer 后必须 `pod install`** —— `react-native-video` 7.x / Skia / fs 都有原生代码,升级后不重跑 `cd ios && bundle exec pod install` 会在编译/运行时报原生符号缺失。Android 端 Gradle 自动同步,无需额外配置。
- **相机弹窗 / toast 自洽,无需为相机挂 host** —— 二次确认 / toast 由相机内部 `CameraDialogHost`(`useCameraDialog()`)在相机 Modal 子树内渲染,不依赖 App 根的 design `<ConfirmHost/>` / `<ToastHost/>`(见上「与 design 的耦合」)。若消费者用 design 其它命令式组件(本库之外),仍按 design 文档自行挂 host。
- **必须真机调试** —— 相机 + 水印需要真机摄像头硬件 + Skia GPU。iOS 模拟器 / Android 模拟器 / web 都跑不起来,这是**预期行为,不是 bug**。
- **仅新架构** —— 依赖 Nitro / vision-camera 5.x,旧架构(Bridge)不支持。**iOS 15.1+** / Android API 24+。(最低 iOS 由 RN 0.85 core 决定:RN 0.80+ 把 `min_ios_version_supported` 抬到 `15.1`,vision-camera / nitro / nitro-image / video / fs / blur 等 RN-core podspec 都继承它;Skia 写死 14.0、reanimated/worklets 13.4 更低,取**最高**即 15.1。)
- **权限按实际能力配置** —— Camera 是拍照 / 录像必需权限:iOS `NSCameraUsageDescription`,Android `android.permission.CAMERA`;用户拒绝后走 `code: 403`。Microphone 只在使用 video 时需要:iOS `NSMicrophoneUsageDescription`,Android `android.permission.RECORD_AUDIO`;本库在开始录像前请求,拒绝时不创建 Recorder、不 settle `403`,而是留在当前 session 显示录像启动错误。库只返回临时文件,不写系统相册,因此 `NSPhotoLibraryAddUsageDescription` / `READ_MEDIA_IMAGES` 不是本库无条件要求;消费者另行保存或读取相册时再按自己的实现配置。

## 测试

- jest 用 `@react-native/jest-preset`(RN env,**不是** design 那种 node 覆盖)。`jest.setup.ts` mock 掉 vision-camera 的 hooks(`useCameraPermission`/`useCameraDevice`/`usePhotoOutput`/`useVideoOutput`…)、nitro modules,使纯逻辑/组件测试能在无原生环境下跑。
- 测试**统一在 `src/__tests__/`,镜像源码结构**(不再与源码 colocate)—— 如 `src/camera/footer/Shutter.tsx` → `src/__tests__/camera/footer/Shutter.test.tsx`,根级 `src/__tests__/{useCamera,mock,contract,types,...}.test.tsx`。覆盖 hook 行为、组件渲染、水印 layout、纯工具函数 —— 不测真实相机(那要真机)。
- **消费者用包内官方 mock**(给下游,不是本仓测试):
  ```ts
  jest.mock('@unif/react-native-camera', () => require('@unif/react-native-camera/mock'));
  ```
  mock 下 `useCamera()` → `[api, null]`,`api.open` 默认 resolve `{ code: 0, data: [], message: 'cancelled' }`(`api.open`/`close` 是 `jest.fn`,成功用例用 `mockResolvedValueOnce`)。纯工具(`toFileUri` 等)保留真实实现(`src/mock.ts` re-export 真 utils)。

## 构建(`react-native-builder-bob`)

`yarn prepare` 输出到 `lib/`:`lib/module`(ESM,`esm: true`)+ `lib/typescript`(`.d.ts`,用 `tsconfig.build.json` —— 继承 `tsconfig.json` 并排除 `example/` `website/` `lib/`)。`package.json#exports` 暴露两个入口:`.`(主包)和 `./mock`,各自三元组 `source: src/*.tsx`(workspace 消费者)+ `default: lib/module/*.js` + `types: lib/typescript/src/*.d.ts` —— 不要破坏这个映射。

## 仓库内注释风格

现有代码用中文记录非显而易见决策的 **why** —— 比如为什么 `requestPermission` 必须 `.catch` 兜底(vision-camera #3834 Android coroutine leak)、为什么启用 `ultra-wide-angle` 超广角后仍要真机验证不复现 iOS #3773、为什么相机弹窗走本地 `CameraDialogHost` 而非 design 全局 host(会被相机 Modal 盖住)、为什么水印 Skia 对象要逆序 dispose、为什么 photo id 用「时间戳 + 计数器」(防同毫秒撞 id)、为什么 worklet 内尺寸必须先在 worklet 外预算成数字常量(design `r()` 是 Remote Function,worklet 里调会 fatal,2.15.1 踩过)、为什么 photo 流恒固定全幅 UHD_4_3 而 16:9 靠拍后 Skia 裁切(targetResolution 不变 → 切画幅 session 零重配不闪断,原生丝滑的根)、为什么 controller shadow 必须同步推进(同一 call stack 拒绝重复 UHD / Skia operation)。保持这个标准:能不写注释就不写,但当读者会想「为什么要这样写」时,就写一句把 why 讲清楚。
