---
title: 库能力与研发技能
description: 'Unif Camera 的公开使用、源码维护与按需资料入口。'
---

# 库能力与研发技能

`unif-camera` 用于本库的使用、维护和排障。技能在开发工具中使用，应用通过 npm 接入本库。

在 Codex 的 `unif-portal-dev-skills` 市场，安装公共规范插件 `unif-platform-rules` 和提供 `unif-camera` 的库能力插件 `unif-library-skills`。需要 Unif 的 React Native 开发、测试或审查规则时，再安装 `unif-react-native-skills`。读取私有技能仓需要相应权限和 Git 认证。[技能仓安装说明](https://github.com/unif-skill/unif-portal-dev-skills#安装与使用)

- **使用本库**：从 `unif-camera` 定位公开 API、示例和必要的接入/生命周期约束，核对应用实际采用版本。
- **维护库工程**：目录与文件组织采用 `uni-code-organization`，RN 实现采用 `uni-rn-dev`，库工程与分发采用 `uni-rn-library`，文档采用 `uni-documentation`。这些通用工程技能与本库能力技能分别维护；按仓库开发资料定位契约和真实消费者。
- **设计、测试、审查与交付**：沿用工程的对应规则；已配置共用阶段技能时按需使用，同一任务复用已有有效依据。

涉及其他自有库时按需查对应公开资料，已安装的能力技能可辅助定位。准确接口以采用版本的公开类型与文档为准；[LLM 文档索引](https://unif-design.github.io/react-native-camera/llms.txt) 声明构建版本，官网新能力不能直接当作旧依赖已支持。

技能源码和安装更新方式由技能仓维护，API 和示例由本库维护；生成文档从源重新生成，不复制维护第二份 API。
