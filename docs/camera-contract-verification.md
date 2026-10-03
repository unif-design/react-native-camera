# Camera 契约实现与验证

本次改动实现[目标契约](../../unif-platform-architecture/libraries/react-native-camera.md)。以下是 2026-09-29 的本地验证记录，不代表版本已发布或真机验收完成。

## 行为与消费

- 公共入口仅提供 `useCamera` 和所属类型。输入按照片、连拍、录像区分；结果采用 `success / cancelled / failed`，成功媒体仅交付 URI 与实际元数据。
- 每次 `open` 接收自己的 AbortSignal；合法调用替换旧交互，非法或已取消的输入不影响旧交互。未渲染宿主明确失败，卸载只结束原调用，StrictMode 临时重放保留当前交互。
- 输入在调用时快照化；已交付文件不因后续取消被删除。照片处理、录像读取和迟到文件仍由原事务负责清理。
- 显式照片质量优先级和 HDR 不静默降级；HDR 拍摄前核对最终配置回执。设备对象变化与原生重配边界一致，Container 的配置代次隔离整个 Camera 及其原生 outputs。
- 原生录像读取实际尺寸、旋转方向和可用时长。Android 使用 MediaMetadataRetriever，iOS 使用 AVFoundation；读取失败保留可恢复错误，不返回零尺寸成功媒体。
- 取景保持暗色表面，控件继承外层 Design 字号。确认使用 Design ConfirmHost，并与局部提示一起归本轮交互；替换交互保留外层 RN Modal 窗口。iOS 继续使用 overFullScreen。
- Web 入口只加载 React，返回 `unsupported`；mock、示例和网站已迁移。旧类型、数字结果码、公共 `close` 和重复媒体字段已移除，迁移见[迁移指南](../website/docs/migration.md)。

## 已执行验证

环境：Node 24.13.0、npm 11、Yarn 4.11.0，与工程要求一致。

| 验证 | 结果 |
| --- | --- |
| `yarn test --runInBand --watchman=false` | 78 suites / 732 tests 通过，包括真实 Design 消费、示例及事务集成测试 |
| `yarn lint`、`yarn typecheck` | 通过 |
| `yarn prepare` | 87 个模块及公开 TypeScript 声明构建通过 |
| website `check` | TypeScript、LLMS 生成测试及 Docusaurus 构建通过 |
| Android / iOS React Native Codegen | 两端生成通过，包含录像元数据方法 |
| Android `:unif_react-native-camera:compileDebugKotlin` | 库原生代码编译通过 |
| iOS 录像读取方法 | 提取实际方法至 macOS AVFoundation harness，用生成的横向及旋转视频验证尺寸、时长，并验证缺失文件失败 |
| `npm pack` 后独立消费者 | 实际 tarball 的 bundler 模式 TypeScript 消费通过；browser 条件解析运行通过，控制器稳定、明确 unsupported、未加载原生模块 |
| 独立代码审查 | 已修复暗色/字号、HDR 回执及局部确认归属问题，对相应回归先验证失败再修复 |
| `git diff --check` | 通过 |

## 待完成的交付验证

- PR 当前提交的完整 CI，包括 Android example APK 与 iOS example 构建。本机的库编译和 AVFoundation 方法验证不能代替它们。
- 真实设备拍摄、厂商 HDR 协商、权限对话框、录音录像、VoiceOver/TalkBack，以及 iOS 关闭相机后原页面/文档和状态栏恢复。
- 正式发布后，以真实版本和锁文件升级 Portal，验证 H5 和原生入口。用于本地验证的 tarball 保留原 package.json 版本，不能作为新正式版本使用。

本次公开 API 为破坏性变更，应在提交和 PR 中声明 BREAKING CHANGE，并遵守现有发布流程及 major 发布闸门。

## 2026-09-30 质量审查修复

本轮起点为 `feat/camera-contract` 的 `0ad87c9`。落实已接受的审查问题和内部职责优化，公开 API、依赖及锁文件未变；截至 9 月 30 日本轮记录时未提交、推送或创建 PR。

### 实现

- 首次录像先配置预览。用户点击快门后申请麦克风，并等待启用音频的输出配置完成才创建 recorder。准备过程保留原操作身份和取消信号；拒绝、配置失败及 10 秒无回执会恢复操作。重试重新配置，旧输出回执不能唤醒新操作。`useVideoOutputController` 负责这条原生适配链，照片的配置回调继续直接传递。
- Android 与 iOS 的裁切比按已经应用 EXIF 方向的输入尺寸选择横向或纵向，保留中心裁切。改动只有 `UnifPhotoProcessorModule.kt` 和 `UnifPhotoProcessor.mm` 中的比例计算。
- 创建后未开录的 recorder 在取消/卸载后迟到时，先读取 `filePath`，再 dispose，并把文件交回原操作的 registry 清理。不会调用未启动 iOS recorder 的 `cancelRecording`；成功交付路径仍按原有所有权规则保护。
- 录像继续每 250ms 采样，但只在显示秒数变化时派发进度状态；停止和最终交付保持精确时长。
- 图库、关闭预览、删除、清空和保存由 `useCameraMediaActions` 服务照片与视频。照片事务只管理拍摄、处理与冻结帧；共用文件丢弃逻辑收拢到 `fileRegistry`。

### 红绿证据

| 回归 | 修复前 | 修复后 |
| --- | --- | --- |
| 首次录像完整调用链 | 最初 5 个用例中 4 个失败：快门不可用/麦克风请求不可达 | 9 个集成用例通过，包含首开、切模式、预授权、拒绝、授权迟到、配置等待/取消、失败重试与超时重试 |
| 配置失败后重试 | 初版修复只能恢复快门，第二次操作未产生新配置 | 新输出收到回执后开录，旧回执被忽略 |
| 两端生产裁切函数 | `1920×1080 / 16:9` 被裁为 `607.5×1080` | 每端 9 组横竖/中心裁切用例通过；iOS 另覆盖非零 extent 原点 |
| 未开录文件归属 | cancel/dispose 两个用例的真实临时文件均残留 | 原 registry 删除文件，原生 start/cancel 均未调用，dispose 一次 |
| 录像计时刷新 | 同一显示秒内三次采样造成三次额外 React render | 同秒没有额外 render；停止 `1.875s`、完成 `1.95s` 的精度保留 |

永久测试分别在 `Camera.videoPermission.integration.test.tsx`、`recorderController.test.ts`、`useVideoTransaction.test.ts` 和 `scripts/__tests__/native-photo-geometry.test.mjs`。原生几何测试从当前生产源文件提取并编译实际函数，不维护另一份算法；需要本机 Clang 和现有 Android Gradle Kotlin 缓存。照片/视频共用媒体操作另有 8 个行为用例。

### 本轮验证

环境：Node 24.13.0、Java 17；以下命令均在本库执行，Android 命令在 `example/android` 执行。

| 命令 | 结果 |
| --- | --- |
| `node node_modules/jest/bin/jest.js --runInBand --watchman=false` | 80 suites / 748 tests 通过 |
| `node node_modules/typescript/bin/tsc` | 通过 |
| `node node_modules/eslint/bin/eslint.js '**/*.{js,jsx,mjs,ts,tsx}'` | 0 错误；已有 `coverage/lcov-report` 生成产物带 3 条 eslint-disable 警告，本轮未改这些产物 |
| `node node_modules/react-native-builder-bob/bin/bob build` | 89 个模块及 TypeScript 声明构建通过，对应 `prepare` 脚本 |
| `node --test scripts/__tests__/*.test.mjs` | 3 个用例通过，包含两端生产几何函数编译/运行，未跳过 |
| `./gradlew :unif_react-native-camera:compileDebugKotlin --offline --console=plain --max-workers=2` | 实际模块编译通过，11 秒；19 tasks，3 executed |
| iOS example / Xcode 27 | 当前源码隔离副本的 Debug Simulator 完整编译及链接通过；重用 Pods 后执行真实 pod install 同步，命令附加 `IPHONEOS_DEPLOYMENT_TARGET=15.1`。这是现有 iOS 27 环境补充编译，不等同于仓库指定 Xcode 版本的 CI |
| 独立最终审查 | 核对锁定 SDK 源码与最终改动，7 suites / 126 tests、两端生产裁切复验通过，未发现可证实新增 P1/P2 |
| `git diff --check` | 通过；HEAD 与索引未改 |

### 验证边界

本轮没有重跑完整 example Android APK 构建；本轮 iOS 补充编译通过。原生几何用例验证实际算法，不等价于真机 JPEG/水印全流程验收。麦克风授权集成用例使用真实 Container、Camera 与事务控制器，并在 VisionCamera 边界复现已安装 5.0.11 的授权/配置前提；系统授权弹窗、设备录音与音视频同步仍需真机确认。计时优化有 React render 次数证据，未做真机 CPU、帧率或峰值内存基准，因此不能据此宣称整体性能已达到最优。

## 2026-10-03 提交前复验

在 `feat/camera-contract` 接续交付，复验前 18 个变更文件的 SHA-256 与 9 月 30 日最终审查归档全部一致。环境仍为 Node 24.13.0、Yarn 4.11.0、Java 17。

| 命令 | 结果 |
| --- | --- |
| `yarn test --maxWorkers=2 --coverage --watchman=false` | 80 suites / 748 tests 通过；statements 92.41%、branches 87.83%、functions 90.87%、lines 93.93% |
| `yarn typecheck` | 通过 |
| `yarn lint` | 0 错误；覆盖率 HTML 生成文件仍有 3 条 eslint-disable 警告 |
| `yarn prepare` | 89 个模块及 TypeScript 声明构建通过 |
| `node --test scripts/__tests__/*.test.mjs` | 3 个用例通过、0 跳过；包含两端当前生产裁切函数的编译与运行 |
| `clang-format --dry-run --Werror ios/UnifPhotoProcessor.mm` | clang-format 18.1.8 检查通过 |
| `ktlint android/src/main/java/com/unif/reactnativecamera/UnifPhotoProcessorModule.kt` | ktlint 1.8.0 检查通过 |
| `git diff --check` | 通过 |

为满足现有提交 hook，iOS 文件按 clang-format 18.1.8 格式化。与复验前源文件相比，Clang 词法 token 在合并 C 语言相邻字符串后完全一致，变化限于排版、注释换行及一处日志字符串拆行；格式化后重新运行了两端原生几何测试。其他实现源码沿用上述完整验证与独立审查证据。

本轮没有重跑完整原生 example 构建；9 月 30 日的 Android 模块编译、iOS example 构建及更早的 Android example 构建按各自源码快照保留历史证据。PR 当前提交的完整 CI、真机拍摄和正式版本的 Portal 接入仍分别验收。
