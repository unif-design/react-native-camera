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
