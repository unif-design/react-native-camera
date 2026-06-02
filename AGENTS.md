# Agent Rules — @unif/react-native-camera

<!-- BEGIN:unif-agent-rules -->
## 用本库写代码(consumer)

- **Agent Skill**: `using-unif-camera`(在 `unif-react-native` plugin)。装:
  `/plugin marketplace add unif-design/react-native-skills` → `/plugin install unif-react-native@unif-react-native-skills`
- **API 文档**(纯 Markdown,供抓取,别凭记忆编):
  - 索引: https://unif-design.github.io/react-native-camera/llms.txt
  - 全文: https://unif-design.github.io/react-native-camera/llms-full.txt

## 改本库代码(contributor)

- 开发/发布规范走仓库 README + `.github/`(CI / release / native-lint)。
- 改组件 / API / 类型时,**同步更新 `website/docs/`** —— llms.txt 由 `website/scripts/build-llms.js` 从 docs 生成,文档即 AI 的数据源。
<!-- END:unif-agent-rules -->
