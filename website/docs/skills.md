---
title: 库能力与研发技能
description: 'Unif Camera 的公开使用、源码维护与按需资料入口。'
---

# 库能力与研发技能

团队具有 [unif-portal-dev-skills](https://github.com/unif-skill/unif-portal-dev-skills) 的访问权限时，可使用 `unif-camera` 处理本库能力的使用、维护和排障。安装 npm 包无需安装技能；技能也不进入产品运行时模型上下文。

- **使用本库**：从 `unif-camera` 定位公开 API、示例和必要的接入/生命周期约束，核对应用实际采用版本。
- **修改库源码**：同时采用 `code-development` 的库开发规则，按本仓开发资料定位源码、契约和真实消费者。
- **设计、测试、审查与交付**：按当前阶段采用 `architecture-design`、`code-testing`、`code-review`、`code-delivery`；同一任务复用已有有效依据。

涉及其他自有库时只读取对应能力技能。准确接口以采用版本的公开类型与文档为准；[LLM 文档索引](https://unif-design.github.io/react-native-camera/llms.txt) 声明构建版本，官网新能力不能直接当作旧依赖已支持。

技能源码和安装更新方式由技能仓维护，API 和示例由本库维护；生成文档从源重新生成，不复制维护第二份 API。
