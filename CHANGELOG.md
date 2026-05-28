# Changelog

本项目遵循 [Conventional Commits](https://www.conventionalcommits.org/) 与 [Semantic Versioning](https://semver.org/)。
此文件之后由 release-it + conventional-changelog 自动维护；下面的早期版本为手动回填。

## 2.2.0

发版自动化修复后的第一个对齐版本（git 与 npm 重新同步）。

- **ci**: 接入 GitHub App token 发版，bypass 受保护 main 的 ruleset（`github-actions[bot]` 进不了 bypass list）
- **ci**: 新增 PR 标题 conventional commits 校验（squash merge 时 PR 标题即 commit message，release-it 据此判版本）
- **ci**: release.yml 防自触发死循环（release commit 带 `[skip ci]` + job 级 guard）
- **ci**: dependabot patch/minor 自动合并
- **docs**: 新增 SECURITY.md、feature_request issue 模板、README badges

> 注：npm 上 `2.1.0` 因早期发版流程缺陷（npm publish 成功但 git push 被 ruleset 拦）未对应 git tag / Release，已作为孤儿版本跳过，本项目从 `2.2.0` 起 git 与 npm 对齐。

## 2.1.0

> 已 publish 到 npm（2026-05-27），但发版流程修复前 git tag / GitHub Release 缺失。

- **feat**: 升级 `@unif/react-native-design` 到 0.3.0；release-it 启用 `npm.skipChecks` + CHANGELOG 落盘
- **ci**: PR Agent + DeepSeek 自动 review（含 vision-camera 5.x 特有规则）
- **docs**: CONTRIBUTING 链接 org AUTOMATION 标准

## 2.0.0

> 已 publish 到 npm（2026-05-27）。基于 react-native-vision-camera 5.x 的完全重写。

- **feat**: 用 `react-native-vision-camera` 5.x 重写相机库——`useCamera()` hook + 单拍 / 连拍 / 视频录制 + 捏合变焦 + 镜头切换 + 点击对焦
- **feat**: 全量接入 `@unif/react-native-design` 设计系统（主题 token + Empty / Button / Chip / Segmented / Spinner 等组件）
- **BREAKING CHANGE**: 移除 `cameraMode[i].photoResolution` / `videoResolution` 与 `watermark` 配置；新增 `photoQuality` / `jpegQuality`；全部 public 类型从包顶层导出（不再走 deep import）
