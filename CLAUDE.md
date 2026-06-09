# CLAUDE.md

<!-- Cross-agent rules live in AGENTS.md (Cursor / Codex / Copilot read it directly). Claude Code does not read AGENTS.md, so CLAUDE.md @import-s it below to keep a single source of truth. Add Claude-specific instructions under this comment. -->
@AGENTS.md

## 仓库定位

`@unif/react-native-camera` —— 基于 [react-native-vision-camera](https://github.com/mrousavy/react-native-vision-camera) 5.x 封装的**弹窗式相机**:单拍 / 连拍 / 录像 / 滚条变焦 / 镜头翻转 / 点击对焦 / Skia 水印。目标运行时:**RN 0.85 新架构**(Fabric + Nitro Modules)、React 19、TypeScript 6。

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
yarn workspace website build:llms   # 重生成 llms.txt / llms-full.txt(docs 是其唯一来源)
```

**只用 yarn** —— 项目依赖 yarn workspaces(`packageManager: yarn@4.11.0`)。pre-commit hook(lefthook)对 staged 文件跑 `eslint` + `tsc`;commit-msg 用 commitlint 强校验 conventional commits。

## 架构与约定

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
  - `cameraMode: CameraMode[]` —— 每项 `{ mode: 'single' | 'continuous' | 'video', quality?, type?, flashMode?, recTime? }`。`type`/`flashMode`/`recTime` 是原版 4.x 兼容字段(部分 no-op),实际拍摄参数在相机内 UI 控制。
  - `dataRetainedMode: 'clear' | 'retain'` —— 用户切换拍摄模式时已拍文件:`clear` 先二次确认(相机内本地 `confirm`,见下)再清空、且「单拍 + clear」拍完直接进确认预览;`retain` 累积不清。
  - `watermark?: WatermarkType` —— 见下。

### Result codes(`CameraResult.code`,在 `Container.tsx` 接线)

`0 | 200 | 403 | 404 | 500 | 503`。**只有 `200` 是成功**(取 `res.data: CustomPhotoFile[]`);`0` = 取消/关闭;`403` = 无权限;`404` = 无相机设备;`500` = 拍摄失败 / 配置非法;`503` = 录像失败。判成功务必 `=== 200`,别把 `0` 当成功。

### Skia 水印(`src/camera/watermark/`)

- `WatermarkType`:`content: string[]`(每项一行,第 0 行加粗)+ `position`(六选一,缺省 `'top-right'`)。
- 烧录在快门后**串行逐张**进行(一次只烧 1 张,峰值内存恒定;footer 显示「正在生成水印图片…」)。`burnWatermark.ts` 走 `@dr.pogodin/react-native-fs` 读字节 → Skia 离屏全分辨率 surface 画原图 + 逐行画字 → 编码 JPEG → 写临时文件。
- **只对照片(`mime === 'image/jpeg'`)生效,录像无水印**。烧录任何异常(解码/分配/读写失败)**都返回原图,绝不阻断保存**。Skia 是 C++ 包装对象,`finally` 里按逆序 `dispose()` 释放原生内存(防大图反复烧 OOM)—— 改这段务必保留 dispose。

### 与 `@unif/react-native-design` 的耦合(`>=0.8.1`)

design 是必装 peer,本库从它取:`Button` / `Icon`(图标全用 design,不自绘,详见下「图标」)、`useColors`(暗色 token)、字号语义 token(`type` / `t.*`)与字重 `fw`、`r()`(缩放)、`ThemeProvider`(`ModalView` 用 `forceScheme="dark"` 强制深色)。

- **确认弹窗 / toast 是相机内部本地实现,不依赖宿主 host**:`src/camera/ui/CameraDialogHost.tsx` 暴露 `CameraDialogProvider` + `useCameraDialog()`(`{ confirm, toast }`)。`Container.tsx` 用 `const { confirm } = useCameraDialog()` 做切模式/放弃拍摄的二次确认;预览页 toast 同源。**Why 本地而非 design 全局 `confirm`/`toast`**:相机是 RN `<Modal>`,design 的 `ConfirmHost`/`ToastHost` 挂在消费者 App 根,App 根的弹窗叠不到已 present 的相机 Modal 之上 → 会被相机盖住。`CameraDialogHost` 用相机 Modal 子树内的高 zIndex absolute overlay(非 RN Modal),正常显示在相机之上。因此**消费者无需为相机挂 `<ConfirmHost/>` + `<ToastHost/>`**(改 dialog 行为只动这个文件)。

### 图标 / 主题 / 取景布局

- **图标全用 design `Icon`,本库不自绘** —— 例如音量按钮用 `name={sound ? 'sound' : 'sound-off'}`(`sound-off` 是为本库新增的 design 图标)。唯一例外:`FocusIndicator`(点击对焦的动画环)是动画图形,留在 camera。
- **字体 / 颜色全走 design token** —— 字号用 design 语义 token(`type` scale / `t.*`)、字重用 `fw`;颜色全 `useColors()` token。`ModalView` 套 `ThemeProvider forceScheme="dark"` 强制深色,内部组件恒取 dark token。仅 `src/camera/colors/viewfinder.ts` 留几个 design token 无法表达的**取景物理常量**(纯黑 letterbox 底、半透明黑玻璃药丸、iOS 标准录制红 + 其 tint、水印阴影)。
- **取景画面整屏垂直居中** —— 系统相机式布局:取景器铺满并垂直居中,控件浮层(zIndex)叠在画面上。
- **画幅比例用文字切换** —— `4:3` / `16:9` 文字按钮(非图标),默认 `4:3`。
- **变焦是连续水平滚条(`src/camera/footer/ZoomSlider.tsx`),不是离散点击档位** —— 保留档位药丸做快速跳档,在其上 `Pan` 连续变焦(对数曲线,拖动时浮大号倍数),软上限 10x(`SOFT_MAX_DISPLAY`,`device.maxZoom` 多镜头可达 ~123x 但 >10x 是纯数字裁切、画质崩不实用)。**双指 pinch 缩放已移除**(`Camera.tsx` 仅保留点击对焦),改用滚条。**前置无超广角 → 不渲染变焦条**(前摄定焦、0.5x 不存在;切回后置恢复)。
- **0.5x 超广角已启用** —— `Container.tsx` 的 `physicalDevices: ['ultra-wide-angle', 'wide-angle']`(启用超广角后需真机验证不复现 iOS #3773)。**0.5x 的「用户倍数」经 vzf↔display 转换**:vision-camera 的 `zoom` 是 virtual-device zoom factor(vzf,相对最广镜头),不是用户倍数;`displayMul = 1 / device.zoomLensSwitchFactors[0]`(后置超广角机型 switch0=2 → displayMul=0.5,vzf 1.0=超广角=用户 0.5x、vzf 2.0=广角=用户 1x)。无超广角(前置 / 单广角)switchFactors 为空 → displayMul=1 fallback。**注意不是「`device.minZoom ≤ 0.5` 直接显示 0.5x」(那是错的,minZoom 是 vzf 不是用户倍数)。**
- **预览页底部按钮:扫一扫式「上 icon 下文字」圆形按钮** —— 返回(`undo`)/ 删除(`trash`,已放大,小尺寸 3 条 stroke 会糊)/ 重拍(`refresh`)/ 保存(`check`);返回、重拍=浅灰白圆,删除=橙圆,保存=红圆。
- **无网格** —— 不提供九宫格构图叠加层。

## 关键坑

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

## 文档指针

- **API / props / 类型全量** → 文档站 + 远程 llms.txt(按需 fetch,**不在本仓镜像**):
  - 文档站:https://unif-design.github.io/react-native-camera/
  - llms 索引:https://unif-design.github.io/react-native-camera/llms.txt
  - llms 全文:https://unif-design.github.io/react-native-camera/llms-full.txt
- **website docs 是 llms.txt 的唯一来源** —— 改了组件/API/类型,**同步改 `website/docs/`** 再 `yarn workspace website build:llms` 重生成,否则 AI 读到的会过时(`website/scripts/build-llms.js`)。
- **作为消费者接入** → Agent Skill `using-unif-camera`(在 `unif-react-native` 插件;装法见 AGENTS.md)—— 经核实的 API / 坑 / peerDeps,是接入侧的首选入口。

## 仓库内注释风格

现有代码用中文记录非显而易见决策的 **why** —— 比如为什么 `requestPermission` 必须 `.catch` 兜底(vision-camera #3834 Android coroutine leak)、为什么启用 `ultra-wide-angle` 超广角后仍要真机验证不复现 iOS #3773、为什么相机弹窗走本地 `CameraDialogHost` 而非 design 全局 host(会被相机 Modal 盖住)、为什么水印 Skia 对象要逆序 dispose、为什么 photo id 用「时间戳 + 计数器」(防同毫秒撞 id)。保持这个标准:能不写注释就不写,但当读者会想「为什么要这样写」时,就写一句把 why 讲清楚。
