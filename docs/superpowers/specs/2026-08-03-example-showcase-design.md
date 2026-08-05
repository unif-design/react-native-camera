# Camera Example 场景展厅设计规格

日期：2026-08-03

状态：已批准，可进入实现计划

## 1. 背景与目标

当前 `example/src/App.tsx` 把 Provider、相机调用、三个按钮和最后一次 JSON 结果放在一个文件中。
它能验证单拍、连拍和录像，但存在以下问题：

- 没有场景信息架构，使用者难以理解不同配置解决什么问题。
- 新结果覆盖旧结果，无法比较 `clear` / `retain`、质量参数或错误码。
- 成功结果只有原始 JSON，没有媒体预览、关键 metadata 和临时文件风险提示。
- `example/README.md` 仍是 React Native 模板，无法指导真机运行和复制用法。
- 只有 native 配置 contract，没有面向 example 配置工厂和结果语义的纯逻辑测试。

目标是把 example 建成一个独立、产品化且可复制的中文场景展厅。使用者应能从首页进入四个
明确场景，查看实际传给 `api.open()` 的配置，完成拍摄，并在统一结果区理解返回值。
example 同时作为消费方参考实现，但不成为 camera 内部组件的测试入口。

## 2. 范围

### 2.1 范围内

- 重构 `example/src`，加入本地 typed navigation、场景模块、结果模型和共享展示组件。
- 提供基础拍摄、多模式、带水印存证、质量实验室四个场景。
- 使用 `@unif/react-native-design` 统一组件、token、主题和交互语义。
- 保留一个根级 `useCamera()` 实例和一个稳定渲染的 `holder`。
- 为 example 配置工厂、相机会话编排和结果分类增加纯逻辑测试。
- 更新 `example/README.md`，写清安装、运行、场景、结果码和临时文件语义。
- 保留并按模块拆分结果更新 `src/__tests__/exampleConfig.test.ts` contract。
- 把根开发运行图和 example 宿主从 RN 0.85 升级到 RN `0.86.2`，同步匹配的 presets、
  CLI、Metro、类型配置和 lockfile；库对消费者公开的 RN peer 下限保持不变。
- 按 RN 0.86.2 官方模板核对必要的 native 工程差异，但保留现有权限、orientation、新架构
  和产品能力边界。
- 同步根 `AGENTS.md` 与 README：明确当前开发/example 验证基线为 RN `0.86.2`，同时保留
  camera 对消费者的 `react-native >=0.85.0` 公共兼容范围。

### 2.2 非范围

- 不修改 camera 公共 API、公开类型、运行时行为、website 或 `llms.txt`。
- 不修改 `peerDependencies.react-native: ">=0.85.0"` 或其他 camera 公共 peer 范围。
- 除 RN 0.86.2 对齐外不增加或升级无关依赖；继续使用 Design `0.20.0`。
- 不引入 React Navigation、其他导航库或跨仓共享包。
- 不修改 iOS / Android 权限语义，不增加相册、定位或存储权限。
- 不上传、复制、转码或跨 App 重启持久化媒体；不把 example 变成相册。
- 不增加视频播放器、埋点、网络请求或账号能力。
- 不为布局、文案、样式值或 Design 组件内部行为增加低价值 UI / snapshot 测试。

### 2.3 RN 0.86.2 运行图与 peer 例外

Design `0.20.0` 的当前使用约束要求 RN `>=0.86.0 <0.87.0` 与 React `>=19.2.3 <20`。
实现必须形成以下单一运行图，不能同时保留 0.85 与 0.86 两套 RN 工具：

| 位置 | 必须值 |
| --- | --- |
| 根 dev + example runtime | `react-native: "0.86.2"`、`react: "19.2.3"` |
| 根 RN 工具 | `@react-native/babel-preset`、`eslint-config`、`jest-preset`: `0.86.2` |
| example RN 工具 | Babel / Jest / Metro / TypeScript config: `0.86.2` |
| example CLI | `@react-native-community/cli`、`cli-platform-android`、`cli-platform-ios`: `20.1.0` |
| library consumer contract | `peerDependencies.react-native: ">=0.85.0"`，不修改 |
| 仓库工具 | Yarn `4.11.0`、`.nvmrc` Node `24.13.0`，不修改 |

CLI `20.1.0` 与 RN 0.86.2 官方 template 一致。移除仅匹配
`@react-native/gradle-plugin@0.85.0` 的旧 Yarn patch、resolution 和 lockfile 条目；
RN 0.86.2 使用自身的 Gradle plugin，现有 Gradle wrapper `9.3.1` 保持不变。

仓库继续使用 `react-native-reanimated-carousel@5.0.0` 与
`react-native-gesture-handler >=3 <4`。Carousel 发布 metadata 仍声明 RNGH
`>=2.9 <3`，这是唯一批准的 peer 例外。消费方确需 override 时只能在
`react-native-reanimated-carousel` 下做 scoped override，并复用根 RNGH；本 Yarn
workspace 不为消除 warning 增加全局 resolution。禁止 `--force`、`--legacy-peer-deps`
和全局 override。

## 3. 信息架构与本地 typed navigation

导航只维护进程内的 typed stack，不依赖第三方库：

```ts
type ShowcaseRoute =
  | { name: 'home' }
  | { name: 'basic-capture' }
  | { name: 'multi-mode' }
  | { name: 'watermark-evidence' }
  | { name: 'quality-lab' };
```

`useLocalNavigation()` 用 reducer 提供 `push(route)`、`back()` 和 `home()`；根路由不可继续
后退。`ShowcaseNavigator` 对 `route.name` 做穷尽分支，未知路由在 TypeScript 编译期失败。
首页展示四张场景入口卡和本次 App 进程内的结果历史。返回首页不会清除场景输入或结果历史。

建议模块边界：

```text
example/src/
  App.tsx                         # 根 Provider、useCamera、holder
  app/ShowcaseApp.tsx             # 导航与根级结果状态
  navigation/localNavigation.ts   # ShowcaseRoute 与 reducer
  domain/scenarioConfigs.ts       # 四场景 OpenConfig 纯工厂
  domain/cameraRun.ts             # open/close 编排与状态
  domain/resultPresentation.ts    # 结果记录、code 分类、metadata
  screens/                        # Home + 四个场景屏
  components/                     # 场景骨架、配置预览、结果区、媒体卡
src/__tests__/example/
  scenarioConfigs.test.ts         # 配置工厂
  cameraRun.test.ts               # official mock 与 open/close 编排
  resultPresentation.test.ts      # code、history、metadata 投影
```

屏幕只负责表单状态和组合组件；配置构造、结果分类、历史写入不放进 JSX。共享组件不读取 camera
内部实现，也不直接导入 vision-camera。

## 4. 根 Provider 与 holder 装配

根顺序固定为 `GestureHandlerRootView > ThemeProvider > SafeAreaProvider > CameraShowcase`。
`GestureHandlerRootView` 保持 `flex: 1`。`CameraShowcase` 内只调用一次 `useCamera()`，把
`api` 交给根级 run controller，并把 `holder` 在 navigator 之后唯一的根位置无条件渲染。

`holder` 是 hook 每次 render 返回的 React element，不要求引用 identity 稳定；要求的是它
始终占据同一个树位置，不被路由条件卸载。真实 hook 卸载和 `api.close()` 都会把 active
session 强制收敛为 code `0`。展厅不使用 Design 命令式 confirm / toast，因此不挂
`ConfirmHost` / `ToastHost`；相机 Modal 自带自己的确认与 toast host。

## 5. 四个场景

所有场景使用同一结构：用途说明、可选参数、只读“本次 OpenConfig”预览、主操作按钮、最近
结果。配置预览与实际传给 `api.open()` 的对象来自同一工厂，避免文档和运行值漂移。

### 5.1 基础拍摄

- 在 `single`、`continuous`、`video` 中选择一个模式，每次只传一个 `cameraMode`。
- 可选前 / 后摄与初始闪光；照片显示 JPEG `quality`，录像显示 `recTime`。
- 固定 `dataRetainedMode: 'clear'`，突出最小可复制调用。
- 默认示例为后摄单拍、auto 闪光、`quality: 0.9`。
- 照片工厂只生成 `{ mode, type, flashMode, quality }`；录像工厂只生成
  `{ mode: 'video', type, flashMode, recTime }`，不把照片 quality 塞进录像项。

### 5.2 多模式：clear / retain

- 一次传入 `single`、`continuous`、`video` 三项，用户在相机内切换模式。
- 通过 Design 分段控件选择 `dataRetainedMode: 'clear' | 'retain'`。
- 页面明确解释：`clear` 在切模式时确认并清理已有文件；`retain` 跨模式累计文件。
- 结果媒体卡按返回顺序展示，并用 mode 标签帮助比较混合结果。
- 固定模式数组为 single `quality: 0.9`、continuous `quality: 0.9`、video
  `recTime: 15`；请求 `type: 'back'`、`flashMode: 'auto'` 只放在首项，因为当前契约只消费
  首项作为初始镜头与闪光。

### 5.3 水印存证

- 使用单拍照片和 `dataRetainedMode: 'clear'`。
- 用户输入记录标题、手工地点和备注；打开相机时生成当前时间，组成 `content: string[]`。
- 可选择六个公开 `position` 值，默认 `top-right`。
- 页面说明水印只作用于 JPEG，是可视标记而非防篡改证明；不请求定位权限。
- 工厂输出单拍 `quality: 0.9`、`dataRetainedMode: 'clear'` 以及
  `{ content, position }`；空白输入先 trim 并移除，标题为必填，保证水印可见。

### 5.4 质量实验室

- 照片实验展示 mode 内 `quality`，以及根级 `photoQualityPrioritization`、`photoHDR`。
- 录像实验展示 `recTime` 和根级 `videoBitRate`。
- 每个可选根级字段都提供“沿用 SDK 默认”，选中时从对象中完全省略该 key，而不是传
  `undefined`。
- 页面说明质量参数不等于分辨率设置；不暴露分辨率或画幅配置。
- 照片实验只生成 single mode、`quality` 与可选 photo quality / HDR；录像实验只生成
  video mode、`recTime` 与可选 bitrate，两个工厂不携带对方的专用字段。

## 6. OpenConfig 边界

展厅只展示并生成当前公开字段：

| 层级 | 字段 |
| --- | --- |
| `OpenConfig` | `cameraMode`、`dataRetainedMode`、`watermark`、`photoQualityPrioritization`、`photoHDR`、`videoBitRate` |
| `CameraMode` | `mode`、`type`、`flashMode`、`quality`、`recTime` |
| `WatermarkType` | `content`、`position` |

不得出现 `aspectRatio`、resolution、zoom、sound 或其他臆造字段。画幅、变焦、声音和镜头
翻转是相机 Modal 内交互，不伪装成 `OpenConfig`。配置预览是只读 JSON，不允许任意 JSON
编辑绕过 typed 工厂。

typed 工厂还必须符合 runtime validator：`cameraMode` 是非空稠密数组；`quality` 是
finite `0...1`；`recTime` / `videoBitRate` 是 finite 正数；`photoHDR` 是 boolean；
所有 enum 只能取公开值；watermark content 是稠密 string 数组。validator 会重建只含已知
字段的新配置，配置快照和预览必须使用这个规范化形状。

## 7. api.open / close 数据流

1. 用户点击“打开相机”后，场景工厂创建新 `OpenConfig`；`api.open()` 的 validator 会
   规范化并深拷贝数组 / mode / watermark，controller 另存同形快照供历史展示。
2. controller 进入 `opening`，禁用所有重复打开操作，再调用 `api.open(config)`。
3. 相机确认、取消或错误结果 resolve 后，唯一的调用方创建一条不可变历史记录。
4. `finally` 清除 active run；路由切换只读取根状态，不拥有 Promise。
5. `api.close()` 用于根卸载或明确的宿主 teardown。它没有返回值，不在调用时写记录；
   controller 等待原 `open()` Promise resolve 为 code `0` 后只写一次记录。
6. 无 active session 时 `close()` 是 no-op。若 Promise 意外 reject，只写独立 runtime
   diagnostic，不伪造 `500` 或 `503`。

相机打开期间不允许第二次 `open()`，展厅不把 supersede 当作普通产品交互。取消按钮仍由
相机 Modal 提供。非法配置会在替换任何 active session 之前 resolve `500`；展厅的 typed
工厂原则上不会生成该结果，但结果层仍须完整支持。

## 8. 结果历史与结果码语义

历史保存在 `ShowcaseApp` 根状态中，跨路由保留，直到用户点击“清空结果”或 App 进程结束。
不写磁盘、不引入存储依赖。每条记录含 run id、场景、开始 / 结束时间、配置快照和原始
`CameraResult`。

| code | 展示与持久化语义 |
| --- | --- |
| `200` | 成功；保存完整 data，展示媒体卡和临时文件警告 |
| `0` | 中性取消；保存记录但不显示失败态，data 应为空 |
| `403` | Camera 权限被拒；保存 code / `permission_denied`，并提示到系统设置授权 |
| `404` | 前 / 后摄 fallback 后仍无可用设备；保存 code / `no_device` 诊断 |
| `500` | 配置错误；保存配置快照和 `invalid_config` 诊断，不归类为 native 拍摄失败 |
| `503` | 保留的录像失败码；按错误结果完整展示，当前实现没有生产触发路径 |

非 `200` 结果不渲染媒体卡。状态同时用文字、图标和 Design `Tag` 表达，不只依赖颜色。
Microphone 拒绝不会 settle `403`：它在当前录像 session 内显示可重试错误，因此结果历史
不能把“录像启动失败”擅自转换成 `403` 或 `503`。

## 9. 成功媒体与诊断展示

每个 `200` 文件用 Design `Card` 展示。JPEG 可用 RN `Image` 预览；视频显示明确的视频图标
和 metadata，本期不加入播放器。卡片展示 `id`、`mime`、`mode`、`cameraType`、
`width × height`、可选 `duration`、`isRemake`、`path` 与 `uri`。兼容字段
`cameraMode` 与 `mode` 同值，保留在原始 JSON 中，卡片只显示一次模式。`cameraType` 是
fallback 后实际设备；通用相机的 `isRemake` 为 false。

结果区提供可展开的原始 JSON 和配置快照，供复制诊断。所有成功结果旁固定显示：

> 返回媒体仍位于临时目录。code 200 只表示库把文件所有权转交给调用方，不代表文件已持久化；
> 生产业务必须立即复制到持久目录或上传。

展厅故意不复制文件；媒体预览失效时显示空态和上述说明，不把临时 URI 当永久资产。

## 10. Design、主题与 a11y

- Design 组件全部从包根导入；已有 Button、Card、Segmented、Input、Textarea、Tag、NavBar
  等控件必须复用，不手搓等价交互。
- 页面颜色只用 `useColors()` 角色 token，样式用模块顶层 `makeStyles` +
  `useThemedStyles`；不新增硬编码 hex / rgba。
- 展厅跟随 light / dark；相机 Modal 继续使用其内部强制深色主题。
- 可见文字使用简体中文。布局允许系统字体放大，不用固定高度裁切标题、说明和 metadata。
- 图标按钮必须有 `accessibilityLabel`；选项暴露 selected / checked，禁用按钮暴露 disabled。
- 跳转、清空历史等有后果的操作提供简短 `accessibilityHint`；状态码有可读文字。
- VoiceOver / TalkBack 的焦点顺序为标题、说明、配置、主操作、结果，不让原始 JSON 抢首焦点。
- Design 0.20.0 已确认从包根导出上述组件。`NavBar` 不内置 top safe-area，屏幕必须在
  `SafeAreaView` / insets 内承载；`Segmented` 自带 tab / selected 语义，不重复手搓。

## 11. README

`example/README.md` 改为项目专用中文文档，包含：展厅定位、Yarn 4 根目录命令、四场景说明、
公开配置边界、iOS Pods、Android / iOS 权限、真机要求、结果码、临时文件所有权、测试命令
和复制场景到消费 App 的最小步骤。明确模拟器不能验证真实相机和 Skia 水印，README 不再
保留 npm 指令或通用 RN 模板文案。README 同时写明本 example 的 RN 0.86.2 / React 19.2.3
运行图、camera 仍支持 RN `>=0.85.0` 的公共 peer contract，以及 Carousel/RNGH 唯一 scoped
例外和禁止 force / global override 的规则。根 README 与 `AGENTS.md` 中涉及开发基线的
旧 RN 0.85 表述同步改为“公共兼容从 0.85 起、仓库当前用 0.86.2 验证”，不改写公共 API。

## 12. 测试与验证

example 测试显式使用官方 mock：

```ts
jest.mock('@unif/react-native-camera', () =>
  require('@unif/react-native-camera/mock')
);
```

纯逻辑测试覆盖：

- 四个配置工厂生成精确公开字段，SDK 默认选项确实省略 key。
- clear / retain、水印行与位置、照片 / 录像质量参数不会串场。
- mock `api.open` 收到配置并返回后，controller 只写一次历史；`close` 等待 code `0`。
- `200/0/403/404/500/503` 六种结果分类、媒体可见性和 metadata 投影。
- runtime reject 不伪造 CameraResult。

保留 `src/__tests__/exampleConfig.test.ts` 的 Babel plugin、根 Gesture、native peers、权限、
orientation contract；仅按新的根模块路径做窄更新，并增加 provider / holder 唯一装配、
根与 example 的 RN 0.86.2 工具链对齐、camera 公共 RN peer 仍为 `>=0.85.0` 的 contract。
旧 `@react-native/gradle-plugin@0.85.0` patch 断言改为：manifest / lockfile 不再引用旧 patch，
安装后的 0.86.2 plugin 使用兼容 Gradle 9 的 Foojay 1.0.0。不要增加 snapshot、
“能渲染标题”、样式数值或 Design 内部行为测试。

完整门禁依次为：

```sh
yarn install --immutable
yarn typecheck
yarn lint
yarn test --runInBand
yarn prepare
cd example/ios && bundle exec pod install
yarn example build:android
yarn example build:ios
```

`pod install` 完成后回到仓库根执行两个 `yarn example build:*` 命令；这两个 script 已存在于
`example/package.json`。依赖迁移后的 `yarn install --immutable` 必须基于已更新并提交候选
中的 lockfile 运行，不能以跳过 immutable 掩盖漂移。

真机矩阵至少覆盖一台 iPhone 和一台 Android：四场景、前后摄、照片 / 录像、clear / retain、
水印六位置抽查、SDK 默认与显式质量值、取消、相机权限拒绝、light / dark、字体放大、横竖屏。
`404/500/503` 由 official mock 稳定验证；真机不通过破坏环境强造这些结果。

## 13. 验收标准

- 首页可通过 typed local navigation 进入四个场景并安全返回，未引入导航依赖。
- `useCamera()` 和 `holder` 只在根装配一次，四屏共享同一 run controller 与结果历史。
- 所有展示配置都来自 typed 工厂，且只包含公开 `OpenConfig` 字段。
- 四个场景均能查看实际配置、启动相机并看到按 code 分类的持久结果。
- code `200` 展示媒体卡、完整 metadata、原始 JSON 和醒目的临时文件所有权警告。
- 六种结果码都有确定语义；取消不是成功或错误，reserved `503` 仍可诊断。
- UI 使用 Design 组件与 token，在 light / dark、字体放大、VoiceOver / TalkBack 下可操作。
- example README 可让新使用者只按 Yarn 指令在真机启动并复制最小用法。
- 纯逻辑测试、既有 example contract、lint、typecheck、Jest、prepare、两端 native build
  和真机矩阵全部通过。
- 根 dev / example 只解析 RN 0.86.2 与匹配工具，旧 0.85 Gradle patch 已移除；camera
  `peerDependencies.react-native >=0.85.0` 保持不变。
- 根 README 与 `AGENTS.md` 不再把 RN 0.85 写成当前开发运行图，并清楚保留 0.85 公共
  兼容下限。
- camera 公共 API、其他公共 peer 范围、native 权限、website 和库运行时源码保持不变。
