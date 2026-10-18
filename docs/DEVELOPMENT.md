# react-native-camera 开发资料

本仓库维护 `@unif/react-native-camera`，职责为拍摄库。

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
- [本次契约实现与验证边界](camera-contract-verification.md)

命令与依赖版本以 [package.json](../package.json)、锁文件及实际安装为准，验证接线见 [.github/workflows](../.github/workflows/)。本文件不复制通用开发、测试或交付规则；按 AGENTS.md 的阶段技能取得所需规范。

历史 spec、plan 和审查记录用于溯源，不作为当前使用文档或新需求入口。

## LLM 文档生成

`website/docs` 是使用文档源；运行 `node website/scripts/build-llms.js` 可单独生成。共同实现由组织 `templates/llms` 分发，维护源后使用 `sync-llms.cjs` 同步，不手改生成副本。

索引按任务列出单页，全文位于 Optional；包版本取当前 package.json。`node website/scripts/build-llms.test.js` 验证公共生成契约与本库资料，文档站构建沿既有 CI 运行。

## RN 0.88 验证入口

[开发基线与覆盖率](rn88-coverage.md)记录正式依赖、完整源码分母、原生插桩与 example 宿主边界。标准 `yarn test --coverage` 强制库与 example 的 JS/TS 四项 100%；原生检查接入本库 `.github/ci` 钩子。

## 共享主题接入

字体、字重、字距以及固定媒体／品牌调色板统一来自 Design 1.7。取景文字、照片水印与第三方品牌颜色保持原值和语义，普通页面仍随系统明暗主题切换；玻璃材质和减少透明度由 Design 维护。
