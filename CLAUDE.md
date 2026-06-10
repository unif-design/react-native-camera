# CLAUDE.md

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
- **`holder` 是相机模态的 React 宿主节点,必须渲染进树**(位置不限,但节点要存在)。`useCamera.tsx` 里 holder 就是个 `<ModalView>`,`api.open` 只是 `setVisible(true)` + 存 resolver;**holder 没挂 → 没有挂载锚点 → `api.open()` 静默无效、相机不弹**。
- **`api.open(config)` 返回 Promise**,用户在全屏模态内拍摄 → 预览确认 / 取消后 resolve 为 `CameraResult`。取消不 reject(走 `code: 0`)。`ModalView` 自带 `SafeAreaProvider` + `ThemeProvider`,模态内 UI 不依赖宿主的 provider。
- **配置全在 `OpenConfig`**(`src/utils/interface.ts`,改 API 先看这里):
  - `cameraMode: CameraMode[]` —— 每项 `{ mode: 'single' | 'continuous' | 'video', quality?, type?, flashMode?, recTime? }`。`type` 接线为初始前/后摄(首项生效);`flashMode` 接线为初始闪光(首项生效);`recTime` 是原版 4.x 兼容字段、**当前 no-op**(录像不到点自动停)。`quality` = JPEG 压缩 0~1,缺省 0.9。
  - `dataRetainedMode: 'clear' | 'retain'` —— 用户切换拍摄模式时已拍文件:`clear` 先二次确认(相机内本地 `confirm`,见下)再清空、且「单拍 + clear」拍完直接进确认预览;`retain` 累积不清。
  - `watermark?: WatermarkType` —— 见下。
  - **拍摄质量(三个可选,全局)** —— `photoQualityPrioritization?: 'speed'|'balanced'|'quality'` / `photoHDR?: boolean` / `videoBitRate?: number`。**核心约定:缺省(不传)= 库不写入任何偏好,完全走 SDK 默认协商**(不替消费者写死取舍);只有显式传值才下发。`'speed'/'quality'` 在不支持的设备**自动安全降级**为 `'balanced'`(不 throw,见 `Camera.tsx` 的 `supportsSpeedQualityPrioritization` guard)。**与分辨率无关**:照片/录像分辨率已固定 UHD(见下「画幅」),不随这三字段变。

### Result codes(`CameraResult.code`,在 `Container.tsx` 接线)

判成功务必 `code === 200`,别把 `0`(取消)当成功 —— 取消 / 失败时 `data` 为空。

| code | 含义 | `data` |
| --- | --- | --- |
| `200` | **成功(唯一成功码)** | `CustomPhotoFile[]` |
| `0` | 取消 / 关闭 | 空 |
| `403` | 无权限 | 空 |
| `404` | 无相机设备 | 空 |
| `500` | 拍摄失败 / 配置非法 | 空 |
| `503` | 录像失败 | 空 |

### Skia 水印(`src/camera/watermark/`)

- `WatermarkType`:`content: string[]`(每项一行,第 0 行加粗)+ `position`(六选一,缺省 `'top-right'`)。
- 烧录在快门后**串行逐张**进行(一次只烧 1 张,峰值内存恒定;footer 显示「正在生成水印图片…」)。`burnWatermark.ts` 走 `@dr.pogodin/react-native-fs` 读字节 → Skia 离屏全分辨率 surface 画原图 + 逐行画字 → 编码 JPEG → 写临时文件。
- **只对照片(`mime === 'image/jpeg'`)生效,录像无水印**。烧录任何异常(解码/分配/读写失败)**都返回原图,绝不阻断保存**。Skia 是 C++ 包装对象,`finally` 里按逆序 `dispose()` 释放原生内存(防大图反复烧 OOM)—— 改这段务必保留 dispose。

### 与 `@unif/react-native-design` 的耦合(peer `>=0.8.1`)

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
- **画幅比例用文字按钮切换** — `4:3` / `16:9`(非图标,左侧竖栏 `SideRail`),**默认 `16:9`**(`Container.tsx` `useState<AspectRatio>('16:9')`)。**切画幅 = 改 vision-camera 的 `targetResolution`(`UHD_4_3`↔`UHD_16_9`)→ session 重协商**(targetResolution 变会让流闪断/黑一下,**不可避免**),故 `Camera.tsx` 用①取景框高度 `withTiming` 平滑伸缩 + ②盖一层黑色转场遮罩把重协商闪烁藏住(系统相机同款思路)。**16:9 出图直接由相机以 `UHD_16_9` 出**,**不是**拍后 Skia 裁切(无 `cropToRatio`);两个动画 worklet 只读 SharedValue 数字,worklet 内绝不调 design `r()`(见关键坑)。
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

`Container.tsx` 是相机内 UI 总装,**逻辑已抽成 5 个 hook**(改交互流先定位到对应 hook,别在 Container 里堆):

- `usePermissionFlow` —— 权限态(`pending`/`granted`/`denied`);`denied`→`NoPermission`(code 403),`pending`→Loading。
- `useZoomController(device)` —— vzf↔display 推导 + `zoomShared` + 设备切换 clamp(见上「变焦」)。
- `useVideoRecorder(cameraRef)` —— 录像状态机(`recording`/`recSeconds` + start/stop)。
- `useCaptureFlow({...})` —— **拍摄编排核心**:`photos` / 预览态(`previewing` + `previewVariant`)/ 快门(照片+视频分支)/ 保存·取消·切模式 全在这。
- `useAppActive` —— App 前后台(切后台停取景,对齐官方 `isActive=appActive&&isScreenFocused`)。

关键行为(都在 `useCaptureFlow` / `Camera.tsx`):

- **快门防重入**(`capturingRef` 同步守卫)—— state 异步挡不住同帧连点;**没有它疯狂连点快门会让多个 UHD capture + Skia 全分辨率烧水印并发堆积 → 内存峰值叠加 → iOS 直接杀进程(闪退)**。「串行烧水印、峰值内存恒定」只在单次 `onShutter` 内成立,跨次并发靠这个 ref 挡(快门按钮同时 `shutterDisabled={capturing}`)。
- **`isActive = appActive && !burning`** —— 烧水印时停取景(省电 + 释放摄像头),回前台恢复;预览态由 `previewing` 分支整体卸载 Camera。
- **`onError` → 顶部非阻塞错误条,绝不关相机** —— `onError` 是「session 遇到任何错误」的诊断回调(`error` 是普通 Error、无 code 判致命性,且含重开/激活时 session 重启这类**可恢复**瞬时错误)。故只 `warn` + 冒泡给 Container 弹错误条(`useCameraDialog().showError`,带去抖 `ERROR_DEDUPE_MS`、4s 自动消失),**绝不据此 `settle(500)`**:早期无条件 settle 会把重开时的瞬时错误误当致命 → 第二次打开即报错关闭。
- **预览页两种 variant**(`PreviewOverlay`)—— `confirm`(单拍 clear 拍完即进、不分类 tab、显示全 files)/ `gallery`(累积多张、按 `cameraMode` 分类 tab,**单类型也显示其 tab**)。图片 `contain` + **固定灰画布**(`VIEWFINDER.previewCanvas` `#1C1C1E`)：外层容器恒定,只图片比例变 → 不同画幅外层观感一致。
- 镜头翻转图标 `camera-flip`(系统相机通用形态,比 `lens-flip` 直白);翻转直接切 `position`(无翻转动画,真机反馈奇怪故移除)。

## 关键坑

接入 / 改动时最容易踩的,前两个是最高频接入错误:

- **holder 必须渲染** —— 见上;最高频接入错误,缺它相机不弹且无报错。
- **只有 `200` 是成功** —— `0` 是取消;别把取消当成功(取消时 `data` 为空)。
- **peerDeps 必须装齐(缺一即崩)** —— 全部声明在 `package.json#peerDependencies`,以它为准。最易漏的两个:
  - `react-native-vision-camera-worklets`:vision-camera 5.x 把 Frame Processor 拆到这个同伴包并内部 `require`,即使本库不用 Frame Processor,Metro 静态解析仍会命中 → 缺它报 `Unable to resolve module react-native-vision-camera-worklets`。vision-camera 把它当可选 peer,本库已显式声明。
  - `@dr.pogodin/react-native-fs`(**不是** `react-native-fs`)—— `burnWatermark.ts` 用的是 dr.pogodin 这个 **fork**,装错成原始 `react-native-fs` 会冲突。
  - 其余实际用到的 peers:`react-native-nitro-modules` / `react-native-nitro-image` / `@shopify/react-native-skia` / `react-native-video`(7.x) / `react-native-reanimated`(4.x) / `react-native-worklets` / `react-native-reanimated-carousel` / `react-native-gesture-handler` / `react-native-safe-area-context` / `react-native-svg` / `@sbaiahmed1/react-native-blur` / `@unif/react-native-design`(`>=0.8.1`)。`@gorhom/bottom-sheet` **已不再是 peer**(design 0.6 起改纯 RN Modal、本库 `src` 本就没直接用,已移除)。
  - `package.json#peerDependencies` 另声明了 `react-native-webview`(历史保留,`src` 未直接引用),并含 `react` / `react-native`;**完整清单以 `package.json` 为准,以上仅列运行时实际依赖的包**。
- **升级 native peer 后必须 `pod install`** —— `react-native-video` 7.x / Skia / fs 都有原生代码,升级后不重跑 `cd ios && bundle exec pod install` 会在编译/运行时报原生符号缺失。Android 端 Gradle 自动同步,无需额外配置。
- **相机弹窗 / toast 自洽,无需为相机挂 host** —— 二次确认 / toast 由相机内部 `CameraDialogHost`(`useCameraDialog()`)在相机 Modal 子树内渲染,不依赖 App 根的 design `<ConfirmHost/>` / `<ToastHost/>`(见上「与 design 的耦合」)。若消费者用 design 其它命令式组件(本库之外),仍按 design 文档自行挂 host。
- **必须真机调试** —— 相机 + 水印需要真机摄像头硬件 + Skia GPU。iOS 模拟器 / Android 模拟器 / web 都跑不起来,这是**预期行为,不是 bug**。
- **仅新架构** —— 依赖 Nitro / vision-camera 5.x,旧架构(Bridge)不支持。**iOS 15.1+** / Android API 24+。(最低 iOS 由 RN 0.85 core 决定:RN 0.80+ 把 `min_ios_version_supported` 抬到 `15.1`,vision-camera / nitro / nitro-image / video / fs / blur 等 RN-core podspec 都继承它;Skia 写死 14.0、reanimated/worklets 13.4 更低,取**最高**即 15.1。)
- **权限键别漏** —— iOS Info.plist:`NSCameraUsageDescription` / `NSMicrophoneUsageDescription` / `NSPhotoLibraryAddUsageDescription`;Android Manifest:`CAMERA` / `RECORD_AUDIO` / `READ_MEDIA_IMAGES`(13+)。缺则 `code: 403` 或运行崩。

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

## 文档与 skill 同步

- **API / props / 类型全量** → 文档站 + 远程 llms.txt(按需 fetch,**不在本仓镜像**):
  - 文档站:https://unif-design.github.io/react-native-camera/
  - llms 索引:https://unif-design.github.io/react-native-camera/llms.txt
  - llms 全文:https://unif-design.github.io/react-native-camera/llms-full.txt
- **website docs 是 llms.txt 的唯一来源** —— 改了组件 / API / 类型,**同步改 `website/docs/`** 再 `yarn workspace @unif/react-native-camera-website build:llms` 重生成,否则 AI 读到的会过时(`website/scripts/build-llms.js`)。
- **改 API 也要同步消费侧 skill** —— skill `unif-camera`(`unif-design/skills` 仓 `skills/unif-camera/SKILL.md`):**手写部分**(快速开始 / 坑 / `assets/` 模板)手动改;**全量 props** 已路由 llms.txt,随 docs 自动跟随。
- **作为消费者接入** → Agent Skill `unif-camera`(`unif` 插件),装:`/plugin marketplace add unif-design/skills` → `/plugin install unif@unif-skills`。经核实的 API / 坑 / peerDeps,是接入侧首选入口。
- CI / release / native-lint 约定见 `README` + `.github/`。

## 仓库内注释风格

现有代码用中文记录非显而易见决策的 **why** —— 比如为什么 `requestPermission` 必须 `.catch` 兜底(vision-camera #3834 Android coroutine leak)、为什么启用 `ultra-wide-angle` 超广角后仍要真机验证不复现 iOS #3773、为什么相机弹窗走本地 `CameraDialogHost` 而非 design 全局 host(会被相机 Modal 盖住)、为什么水印 Skia 对象要逆序 dispose、为什么 photo id 用「时间戳 + 计数器」(防同毫秒撞 id)、为什么 worklet 内尺寸必须先在 worklet 外预算成数字常量(design `r()` 是 Remote Function,worklet 里调会 fatal,2.15.1 踩过)、为什么切画幅要盖转场遮罩(`targetResolution` 变 → session 重协商闪烁不可避免)、为什么快门要 `capturingRef` 同步防重入(连点并发烧水印 OOM 闪退)。保持这个标准:能不写注释就不写,但当读者会想「为什么要这样写」时,就写一句把 why 讲清楚。
