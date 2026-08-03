# Camera Agent 与 Website CI Gate 设计

## 目标

让 `react-native-camera` 的仓库事实说明与 PR #98 当前实现一致,并让四个 React Native
库共享 CI 在源码或 website 输入变化时验证 website、`llms.txt` 与 Docusaurus 构建。

## 范围

- `unif-design/.github`:更新 `templates/workflows/ci.yml`、模板契约测试及自动验证
  workflow。
- `react-native-camera`:同步共享 `ci.yml`,校准根 `AGENTS.md`。
- 不修改 Camera 公共 API、运行时源码、依赖、版本、tag 或发布流程。
- 不改 Camera Skill PR #10;它继续使用现有分支和 worktree。

## 共享 CI

`changes` job 新增 `website` 输出。以下输入触发 website gate:

- `AGENTS.md`
- `website/**`
- `src/**`
- `package.json`、`yarn.lock`、`tsconfig*.json`
- `.nvmrc`、`.github/actions/**`、`.github/workflows/ci.yml`

`changes` job 单独保留 `contents: read` 并增加 `pull-requests: read`,供 checkout 与
`dorny/paths-filter` 在 PR 事件下读取 changed files,其余 job 不扩大权限。

`website` job 通过 `website/package.json#name` 动态取得 workspace 名,依次执行:

1. `website/scripts/build-llms.test.js`
2. website workspace `typecheck`
3. website workspace `build`

workspace output 先通过 step `env` 注入,再以 `"$WEBSITE_WORKSPACE"` 传给 yarn,不把
PR 可修改的数据直接插值进 shell source。

四个目标仓都有相同的 website 目录、脚本与 workspace 结构,因此 gate 保持在共享模板,
不新增 Camera 专用 workflow,也不允许单仓 `ci.yml` 漂移。

## AGENTS.md 校准

只改 marker 外的 Camera 仓库事实:

- `Container` 已注册 session controller 与 container presence bridge。
- `useCameraSessionController` 已用 reducer 驱动 phase、capabilities、operation token 与
  configuration generation。
- `usePhotoCaptureTransaction` 已接入 `processPhoto()`;处理失败不会交付 raw 照片。
- 每个 session 已有 `FileRegistry`;删除、重拍、取消、supersede 与 unmount 会清理 owned
  临时文件,成功 `200` 前只 transfer 返回文件。

共享 marker、安装命令和 `rn-library` / `camera` Skill 路由保持不变。

## 测试

- 先扩展 `.github` 模板测试并确认它因缺少 website gate 失败。
- 实现共享模板后让测试通过,再同步 Camera `ci.yml`。
- `.github/.github/workflows/validate.yml` 在 PR 与 main push 自动执行 ShellCheck、
  Bash syntax、模板 / AGENTS 同步契约及 pinned actionlint。
- 断言 Camera `ci.yml` 与共享模板逐字一致。
- Camera 运行 website llms 测试、website typecheck、website build、根 typecheck 与 lint。
- 提交前确认 diff 只包含本设计列出的文档和 CI 文件。

## 交付

- `.github` 使用独立任务分支和 PR,不得直接 push `main`。
- Camera 改动提交并 push 到现有
  `fix/camera-state-machine-reliability`,更新 PR #98。
- 合并与自动发布仍由 Camera 会话及现有 workflow 完成。
