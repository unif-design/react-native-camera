# Camera Agent 与 Website CI Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让共享 React Native CI 在 website 相关输入变化时验证 `llms.txt`、类型与构建,并让 Camera 的仓库事实说明与 PR #98 当前实现一致。

**Architecture:** `unif-design/.github` 的 `templates/workflows/ci.yml` 继续作为四仓唯一 CI 真相源;模板通过动态读取 `website/package.json#name` 运行通用 website gate。Camera 只同步模板并维护自身 marker 外的实现事实,不复制新的仓库特例。

**Tech Stack:** Bash、GitHub Actions YAML、Node.js、Docusaurus、Git

## Global Constraints

- `.github` 不在 `main` 上开发或 push;使用 `fix/website-ci-gate` 分支和 PR。
- Camera 使用现有 `fix/camera-state-machine-reliability` 分支,更新 PR #98。
- 不修改 Camera 公共 API、运行时源码、依赖、版本、tag、release 或 Camera Skill PR #10。
- 所有行为变更先写失败测试,再做最小实现。
- Camera `.github/workflows/ci.yml` 必须与共享模板逐字一致。

---

### Task 1: 用契约测试定义共享 website gate

**Files:**

- Create: `/Users/liulijun/tongyi/design/.github/scripts/ci-template.test.sh`
- Create: `/Users/liulijun/tongyi/design/.github/.github/workflows/validate.yml`
- Modify: `/Users/liulijun/tongyi/design/.github/templates/workflows/ci.yml`

- [x] **Step 1: 更新 `.github/main` 后创建任务分支**

```sh
git fetch --prune origin
git pull --ff-only
git switch -c fix/website-ci-gate
```

- [x] **Step 2: 写失败的模板契约测试**

测试必须断言:

- `changes.outputs.website` 存在。
- `changes` job 有 `contents: read` 与 `pull-requests: read` 最小权限。
- `website` filter 覆盖设计文档列出的全部输入。
- `website` job 依赖 `changes`,并只在 `website` output 为 `true` 时运行。
- workspace 名从 `website/package.json#name` 读取。
- resolver 有稳定 id 并写入 `$GITHUB_OUTPUT`;消费端通过 env 引用 workspace。
- job 依次运行 `build-llms.test.js`、workspace `typecheck`、workspace `build`。
- 共享仓 validation workflow 自动调用 shell 与仓库契约测试。

- [x] **Step 3: 运行测试并确认 RED**

Run:

```sh
bash scripts/ci-template.test.sh
```

Expected: 因共享模板尚无 `website` output / filter / job 而返回非零码。

- [x] **Step 4: 最小修改共享模板**

在 `changes` job 新增最小 PR 权限、`website` output 与 filter,随后新增通用
`website` job 和共享仓 validation workflow。不要硬编码 workspace 名。

- [x] **Step 5: 运行共享仓验证并确认 GREEN**

Run:

```sh
bash -n scripts/ci-template.test.sh
shellcheck scripts/*.sh
bash scripts/ci-template.test.sh
bash scripts/sync-agent-standards.test.sh
git diff --check
```

Expected: 全部返回 0。

- [x] **Step 6: 提交共享模板**

```sh
git add .github/workflows/validate.yml scripts/ci-template.test.sh templates/workflows/ci.yml
git commit -m "feat(ci): validate website outputs"
```

---

### Task 2: 以失败测试校准 Camera 的 AGENTS 与 CI

**Files:**

- Modify: `/Users/liulijun/tongyi/design/react-native-camera/website/scripts/build-llms.test.js`
- Modify: `/Users/liulijun/tongyi/design/react-native-camera/AGENTS.md`
- Modify: `/Users/liulijun/tongyi/design/react-native-camera/.github/workflows/ci.yml`

- [x] **Step 1: 扩展 Camera 仓库契约测试**

新增断言:

- `AGENTS.md` 不再宣称 controller / container bridge、reducer generation、`processPhoto()` 或 session `FileRegistry` 未接线。
- `AGENTS.md` 明确记录 PR #98 当前实现事实。
- 本仓 CI 含通用 website output / filter / job。
- `AGENTS.md` 本身属于 website filter 输入,且 `changes` job 有 PR 读取权限。

- [x] **Step 2: 运行测试并确认 RED**

Run:

```sh
node website/scripts/build-llms.test.js
```

Expected: 旧 `AGENTS.md` 与旧本仓 CI 至少一项契约失败,命令返回非零码。

- [x] **Step 3: 校准 marker 外的 Camera 事实**

只更新 `AGENTS.md` 中已经被当前源码推翻的说明;保持共享 marker、Skill 安装命令与路由不变。

- [x] **Step 4: 同步共享 CI 模板**

将 `.github/templates/workflows/ci.yml` 的当前任务分支版本逐字同步为 Camera 的 `.github/workflows/ci.yml`。

- [x] **Step 5: 运行定向验证并确认 GREEN**

Run:

```sh
node website/scripts/build-llms.test.js
yarn workspace "$(node -p "require('./website/package.json').name")" typecheck
yarn workspace "$(node -p "require('./website/package.json').name")" build
cmp ../.github/templates/workflows/ci.yml .github/workflows/ci.yml
```

Expected: 全部返回 0。

- [x] **Step 6: 运行 Camera 回归验证**

Run:

```sh
yarn typecheck
yarn lint
yarn test --maxWorkers=2
git diff --check
```

Expected: 全部返回 0。

- [x] **Step 7: 提交 Camera 补充改动**

```sh
git add AGENTS.md .github/workflows/ci.yml website/scripts/build-llms.test.js docs/superpowers/plans/2026-08-02-agent-website-ci-gate.md
git commit -m "ci: validate website contract"
```

---

### Task 3: 推送并核对远端交付

- [ ] **Step 1: 推送共享任务分支并创建 PR**

```sh
git push -u origin fix/website-ci-gate
```

PR 目标为 `main`,正文说明 website 触发范围、动态 workspace 与四仓同步要求。

- [ ] **Step 2: 推送 Camera 现有任务分支**

```sh
git push origin fix/camera-state-machine-reliability
```

这会更新现有 PR #98,不新建 Camera PR。

- [ ] **Step 3: 最终远端核对**

两个仓库分别确认:

```sh
git status --short --branch
git rev-parse HEAD
git rev-parse '@{upstream}'
```

Expected: 工作区干净,本地 HEAD 与 upstream 相同;不执行合并、tag 或手工发布。
