# react-native-camera 开发资料

本仓库维护 `@unif/react-native-camera`，职责为拍摄库。

## 库能力技能

使用 `unif-camera` 定位本库当前版本的公开能力、接入与排障资料。应用仅消费库时可直接查公开类型和文档。

维护工程按职责采用独立的通用技能：`code-organization` 负责跨平台目录与文件组织，`react-native-development` 负责 React Native 实现，`react-native-library` 负责库工程和分发产物，`documentation` 负责文档与文档站。维护入口见 [AGENTS.md](../AGENTS.md)，适用技能按当前任务独立选择，本文只补充本库的契约和接线。

## 目标契约

[本库新版本设计](../../unif-platform-architecture/libraries/react-native-camera.md)定义职责、公共输入输出、状态和验证边界；[库版本原则](../../unif-platform-architecture/libraries/README.md)明确新旧版本独立。规范根默认是并列的 `unif-platform-architecture` 工作区，其他目录布局由任务提供实际位置。

目标契约用于新版本开发；当前可用接口以实际源码和发布版本为准。版本采用原则在上述库设计索引维护。

## 开发起点

先完成调用与媒体契约，再分别组织照片处理、录像、文件归属和 UI；按目标取消与交付规则接线，相关能力分别验证。

当前可定位的源码与验证入口：

- [公共源码入口](../src/index.tsx)
- [相机调用](../src/hooks/useCamera.tsx)
- [照片处理](../src/camera/image/processPhoto.ts)
- [原生照片处理](../src/camera/image/nativePhotoProcessor.ts)
- [所属单元测试](../src/__tests__/)
- [示例测试与宿主验证](../example/README.md#测试)
- [本次契约实现与验证边界](camera-contract-verification.md)

命令与依赖版本以 [package.json](../package.json)、锁文件及实际安装为准，验证接线见 [.github/workflows](../.github/workflows/)。本文件不复制通用开发、测试或交付规则；根据当前任务选择适用技能并核对项目资料。

历史 spec、plan 和审查记录用于溯源，不作为当前使用文档或新需求入口。

## LLM 文档生成

`website/docs` 是使用文档源；运行 `node website/scripts/build-llms.js` 可单独生成。共同实现由 `github-delivery` 的 `templates/llms` 维护，通过该技能提供的同步工具更新本库脚本，不手改共享副本。

索引按任务列出单页，全文位于 Optional；包版本取当前 package.json。`node website/scripts/build-llms.test.js` 验证公共生成契约与本库资料，文档站构建沿既有 CI 运行。

## RN 0.88 验证入口

[开发基线与覆盖率](rn88-coverage.md)记录正式依赖、完整源码分母、原生插桩与 example 宿主边界。标准 `yarn test --coverage` 强制库与 example 的 JS/TS 四项 100%；原生检查接入本库 `.github/ci` 钩子。

## 共享主题接入

字体、字重、字距以及固定媒体／品牌调色板统一来自 Design 1.7。取景文字、照片水印与第三方品牌颜色保持原值和语义，普通页面仍随系统明暗主题切换；玻璃材质和减少透明度由 Design 维护。

## 交付配置与检查

共享 CI、发布配置和检查工具由 `github-delivery` 的模板与工具维护。Unif 组织值由 `code-delivery` 的 `assets/organization.json` 维护，接入时落实为本库 `.github/organization.json`，记录组织、包名规则、Pages 地址、发布 App 身份及远端设置。工具运行时读取项目文件，不依赖其他技能的安装目录；适用技能按当前任务独立选择。

在仓库根目录按阶段执行：

| 命令 | 检查范围 |
| --- | --- |
| `node .github/scripts/check-delivery.cjs` | 离线检查受管文件、组织配置与 source 元数据。 |
| `node .github/scripts/check-library.cjs pack` | 完成库构建后，检查当前 tarball 的导出、声明与文件清单。 |
| `node .github/scripts/check-library.cjs release` | 发行前校验 README、许可和发布配置，不执行发布。 |
| `node .github/scripts/check-library.cjs published` | 联网核验 npm 当前版本的元数据、下载完整性与实际 tarball。 |

CI 与发布步骤见本库 `.github/workflows/`，组织配置调整以项目文件及当前授权为准。本地检查、远端 CI、npm 发布、文档部署和设备验收分别报告。
