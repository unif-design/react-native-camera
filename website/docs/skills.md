---
title: 库能力与研发技能
description: 'Unif Camera 的公开使用、源码维护与按需资料入口。'
---

# 库能力与研发技能

`unif-camera` 可单独安装，用于本库能力的使用、维护和排障，无需安装整个 `unif-portal-dev-skills` 插件或其他技能。安装 npm 包无需安装技能；技能也不进入产品运行时模型上下文。

按需选择一种分发方式：

1. **单个技能**：准备符合 [Skills CLI 要求](https://github.com/vercel-labs/skills#readme)的 Node.js 和 Git，在目标项目目录运行：

   ```sh
   npx skills add unif-skill/unif-portal-dev-skills --skill unif-camera
   ```

   按提示选择目标工具。也可将获授权分发的 `skills/unif-camera/` 完整复制到目标工具的技能目录，保留 `SKILL.md`、`references/`、`agents/` 及已有文件，不要只复制入口文件。

2. **完整插件（可选）**：需要同时使用多个库能力时，按[技能仓安装说明](https://github.com/unif-skill/unif-portal-dev-skills#安装与使用)安装 `unif-portal-dev-skills`。

技能源仓目前为私有仓库；直接从源仓获取技能需要访问权限及 Git 认证。已获授权分发的完整单技能目录可以独立使用；安装位置与识别方式以目标工具文档为准。

- **使用本库**：从 `unif-camera` 定位公开 API、示例和必要的接入/生命周期约束，核对应用实际采用版本。
- **维护库工程**：目录与文件组织采用 `code-organization`，RN 实现采用 `react-native-development`，库工程与分发采用 `react-native-library`，文档采用 `documentation`。这些通用工程技能与本库能力技能分别维护；按仓库开发资料定位契约和真实消费者。
- **设计、测试、审查与交付**：沿用工程的对应规则；已配置共用阶段技能时按需使用，同一任务复用已有有效依据。

涉及其他自有库时按需查对应公开资料，已安装的能力技能可辅助定位。准确接口以采用版本的公开类型与文档为准；[LLM 文档索引](https://unif-design.github.io/react-native-camera/llms.txt) 声明构建版本，官网新能力不能直接当作旧依赖已支持。

技能源码和安装更新方式由技能仓维护，API 和示例由本库维护；生成文档从源重新生成，不复制维护第二份 API。
