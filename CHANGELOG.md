# Changelog

# [2.6.0](https://github.com/unif-design/react-native-camera/compare/v2.4.0...v2.6.0) (2026-05-30)


### Features

* align public API with original v1.2.5 + fix WYSIWYG preview (2.5.0) ([#18](https://github.com/unif-design/react-native-camera/issues/18)) ([fbb4e04](https://github.com/unif-design/react-native-camera/commit/fbb4e04f57b25c7b9be1ae2047f660cec75f190c))

# [2.4.0](https://github.com/unif-design/react-native-camera/compare/v2.3.0...v2.4.0) (2026-05-28)


### Features

* export jest mock at @unif/react-native-camera/mock for consumers ([#17](https://github.com/unif-design/react-native-camera/issues/17)) ([3238e90](https://github.com/unif-design/react-native-camera/commit/3238e90e9d83222531338e2d04da345fb667a372))

# 2.3.0 (2026-05-28)


### Bug Fixes

* align jest with @react-native/jest-preset and add jest types to tsconfig ([184993f](https://github.com/unif-design/react-native-camera/commit/184993fc18a31bd0b2eba8a7c9743da793b7b91f))
* remount FocusIndicator on each tap to reset animation state ([ded37fb](https://github.com/unif-design/react-native-camera/commit/ded37fb69cc5dd6c0d88ca478eb4f70b6fd5a49e))
* reorder Container branches so preview survives device hot-loss ([b587b02](https://github.com/unif-design/react-native-camera/commit/b587b0207b8564481c5247f496791155c47a07bf))
* use responsive useWindowDimensions and hide done-btn in burst mode ([3381554](https://github.com/unif-design/react-native-camera/commit/3381554af90dc6a2d84ab59cf68b2313dbe4b5be))


### Features

* add core peer dependencies for vision-camera 5.x ([3437ebf](https://github.com/unif-design/react-native-camera/commit/3437ebf34d6db691c96f30e536efd78724fd9bae))
* add core utility functions ([f9ea662](https://github.com/unif-design/react-native-camera/commit/f9ea6629ddd1b6e4adef6cc0a54fa83f8181f8dc))
* add pinch-to-zoom with reanimated ([f2e64a1](https://github.com/unif-design/react-native-camera/commit/f2e64a17f95afbab810fcbcb8867c5ad5d0b3a0f))
* add setup panel with flash/aspect-ratio/lens-toggle ([33d493e](https://github.com/unif-design/react-native-camera/commit/33d493ed585ca61ebccc3418b9d4de8ddb47b9a4))
* add tap-to-focus with animated indicator ([482a20f](https://github.com/unif-design/react-native-camera/commit/482a20fae67668f6075b6f5a23920b5955f71304))
* add useCreation and useConfirm hooks ([f6d6308](https://github.com/unif-design/react-native-camera/commit/f6d6308bbb758753a636fd46b4116408528c4512))
* define public TypeScript types ([7266921](https://github.com/unif-design/react-native-camera/commit/7266921dd57730e4611bd343e2c8c86fb93320bf))
* honor dataRetainedMode and guarantee settle on unmount ([3dcca54](https://github.com/unif-design/react-native-camera/commit/3dcca54730be04cf3785466fdb8ac825b4bf2c5d))
* implement burst (continuous) capture with multi-photo preview ([6850408](https://github.com/unif-design/react-native-camera/commit/6850408a5c3d788d6638e06eac00a55fc033ea07))
* implement multi-mode footer with mode switching ([53fc391](https://github.com/unif-design/react-native-camera/commit/53fc391d5867f26bc9b80a05adc4f5f0b651fcf8))
* implement single photo preview with retake/confirm ([a1be565](https://github.com/unif-design/react-native-camera/commit/a1be565c0583be7db1925ac3519f7b3595403b0b))
* implement single-shot photo capture via vision-camera 5.x ([533852b](https://github.com/unif-design/react-native-camera/commit/533852b893fed2549a32fd2c94f2ecacc59a2306))
* implement useCamera hook skeleton with Promise/Modal ([3777841](https://github.com/unif-design/react-native-camera/commit/377784179b2da68c2473bc701d92868e7b9d1e47))
* implement video recording mode ([0cb648b](https://github.com/unif-design/react-native-camera/commit/0cb648b176873a3c6b0a0e516b284b2964ae64d1))
* integrate @unif/react-native-design and ThemeProvider ([c597c16](https://github.com/unif-design/react-native-camera/commit/c597c16da04149991e5f2f66704fc5bff555cee4))
* integrate useCameraDevice with physical lens preference ([d2c1509](https://github.com/unif-design/react-native-camera/commit/d2c1509bae8e38b0898d04cd63b0b231007df11a))
* integrate useCameraPermission flow ([da61379](https://github.com/unif-design/react-native-camera/commit/da613799535e4226c644a280f76f272a62362d7d))
* refactor all UI to @unif/react-native-design ([5dab57d](https://github.com/unif-design/react-native-camera/commit/5dab57d27317ac477a7a02e51b3c78ba47be84a7))
* rewrite example app with 3-mode camera demo and platform permissions ([a17296b](https://github.com/unif-design/react-native-camera/commit/a17296bcd2dc175f32b0eae8922fda6c810afaf9))
* scaffold modal camera shell with permission/device placeholders ([e75691d](https://github.com/unif-design/react-native-camera/commit/e75691d33d5c13e3328000897014ed45bbaa728b))
* unify error code paths and add contract tests ([7b9f64a](https://github.com/unif-design/react-native-camera/commit/7b9f64a415e93c7b4aa479fb22e27b2d1f5195bb))
* upgrade to design 0.2.0 with camera-specific icons ([ecc6048](https://github.com/unif-design/react-native-camera/commit/ecc6048385a0e19cf5f3e9864645d73e62d4c9a3))

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
