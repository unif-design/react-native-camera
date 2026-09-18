# 参与贡献

欢迎为 `@unif/react-native-camera` 提交问题和改进。交流遵守[行为准则](CODE_OF_CONDUCT.md)。

## 开始开发

1. 阅读[开发资料](docs/DEVELOPMENT.md)，定位本次功能及公开契约。
2. 按 [.nvmrc](.nvmrc) 和 [package.json](package.json) 准备环境，在仓库根目录安装依赖。
3. 使用[示例应用](example/README.md)验证实际消费方式。

```sh
yarn install --immutable --mode=skip-build
yarn typecheck
yarn lint
```

## 验证与提交

先运行受影响的单元和消费者测试；完整测试、库打包及原生构建按 CI 流程执行。原生接线或设备行为发生变化时，补充对应平台验证。

公开接口变化同步所属 API 文档、示例与生成的 llms 资料。提交说明写清变更和实际验证结果，保留工作区中其他任务的修改。

- [AGENTS.md](AGENTS.md)：维护者与 Agent 的技能入口。
- [组织协作流程](https://github.com/unif-design/.github/blob/main/AUTOMATION.md)：PR、CI、版本与发布。
- [安全问题](SECURITY.md)：漏洞报告方式。
