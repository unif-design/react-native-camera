# Changelog

# [2.19.0](https://github.com/unif-design/react-native-camera/compare/v2.18.1...v2.19.0) (2026-06-10)


### Features

* **camera:** 画幅切换丝滑化 — 取景框高度动画 + 转场遮罩盖 session 重配闪烁 ([#69](https://github.com/unif-design/react-native-camera/issues/69)) ([450185a](https://github.com/unif-design/react-native-camera/commit/450185a40ab37060a507b55d2740cbaf612785ef))

## [2.18.1](https://github.com/unif-design/react-native-camera/compare/v2.18.0...v2.18.1) (2026-06-10)


### Bug Fixes

* **camera:** 镜头切换 icon 换 camera-flip(系统相机通用形态,比 lens-flip 直白) ([#68](https://github.com/unif-design/react-native-camera/issues/68)) ([120826c](https://github.com/unif-design/react-native-camera/commit/120826c685019b97780b5f0320719b1a95233573))

# [2.18.0](https://github.com/unif-design/react-native-camera/compare/v2.17.1...v2.18.0) (2026-06-10)


### Features

* **camera:** 预览图片加固定灰色画布容器 — 4:3/16:9 外层观感一致 ([#67](https://github.com/unif-design/react-native-camera/issues/67)) ([6f80d6d](https://github.com/unif-design/react-native-camera/commit/6f80d6d9fb25b5f8c2fd2cebfe462403927d870e)), closes [#1C1C1E](https://github.com/unif-design/react-native-camera/issues/1C1C1E)

## [2.17.1](https://github.com/unif-design/react-native-camera/compare/v2.17.0...v2.17.1) (2026-06-10)


### Bug Fixes

* **camera:** 快门防重入 — 修连点 7-8 下 OOM 闪退 ([#66](https://github.com/unif-design/react-native-camera/issues/66)) ([0138184](https://github.com/unif-design/react-native-camera/commit/0138184edcdc9f673221258322ac6a53a4a86a32))

# [2.17.0](https://github.com/unif-design/react-native-camera/compare/v2.16.0...v2.17.0) (2026-06-09)


### Features

* **camera:** 真机 UI 调优批 — 药丸动效/闪光灯轮换/预览contain/默认16:9/footer/保留模式分类 ([#65](https://github.com/unif-design/react-native-camera/issues/65)) ([b01a770](https://github.com/unif-design/react-native-camera/commit/b01a770eec8e9a267b3c144bce35a790fc239e5f))

# [2.16.0](https://github.com/unif-design/react-native-camera/compare/v2.15.2...v2.16.0) (2026-06-09)


### Features

* **camera:** 变焦回归 pinch + 0.5/1 档位 + 实时倍数(SharedValue 直驱根治卡顿) ([#64](https://github.com/unif-design/react-native-camera/issues/64)) ([7904862](https://github.com/unif-design/react-native-camera/commit/79048622774158f615f9691223e4518c57e5bc94))

## [2.15.2](https://github.com/unif-design/react-native-camera/compare/v2.15.1...v2.15.2) (2026-06-09)

## [2.15.1](https://github.com/unif-design/react-native-camera/compare/v2.15.0...v2.15.1) (2026-06-09)


### Bug Fixes

* **camera:** 错误条动画 worklet 不再同步调 r() — 修切倍数时 worklets fatal ([#61](https://github.com/unif-design/react-native-camera/issues/61)) ([0fdfcb0](https://github.com/unif-design/react-native-camera/commit/0fdfcb09b83b6b4cf3dfe83b8bb7ee9c22d63987))

# [2.15.0](https://github.com/unif-design/react-native-camera/compare/v2.14.1...v2.15.0) (2026-06-09)


### Features

* **camera:** onError 顶部非阻塞错误条 + 不再误关相机 ([#60](https://github.com/unif-design/react-native-camera/issues/60)) ([d58cc75](https://github.com/unif-design/react-native-camera/commit/d58cc75d549253b4131bb078cc8f8c82e51a7158))

## [2.14.1](https://github.com/unif-design/react-native-camera/compare/v2.14.0...v2.14.1) (2026-06-09)


### Bug Fixes

* **camera:** align with vision-camera official example + drop dead code ([#59](https://github.com/unif-design/react-native-camera/issues/59)) ([2713890](https://github.com/unif-design/react-native-camera/commit/2713890d7e8b735cb82c1ce22ef9a62ef9b22129))

# [2.14.0](https://github.com/unif-design/react-native-camera/compare/v2.13.0...v2.14.0) (2026-06-09)


### Features

* **camera:** 变焦滚条 + 0.5x修复 + 按钮/字体token + design 0.8.1 + iOS 15.1 ([#58](https://github.com/unif-design/react-native-camera/issues/58)) ([903286d](https://github.com/unif-design/react-native-camera/commit/903286d0227616a9a2cf3d5c0c7eaa33fcdf9255))

# [2.13.0](https://github.com/unif-design/react-native-camera/compare/v2.12.0...v2.13.0) (2026-06-09)


### Features

* **camera:** UX 迭代3 — 前置禁变焦/后置动态变焦/footer透明/预览按钮 ([#57](https://github.com/unif-design/react-native-camera/issues/57)) ([ac229a5](https://github.com/unif-design/react-native-camera/commit/ac229a5238649553ac741388630953521577ee3d))

# [2.12.0](https://github.com/unif-design/react-native-camera/compare/v2.11.0...v2.12.0) (2026-06-09)


### Features

* **camera:** UX 迭代2 — 保存常显/footer 调浅/默认静音/去翻转/预览按钮 ([#55](https://github.com/unif-design/react-native-camera/issues/55)) ([0bd5d31](https://github.com/unif-design/react-native-camera/commit/0bd5d31b801ffdf13ea2d94c8ff0acfa8243810d))

# [2.11.0](https://github.com/unif-design/react-native-camera/compare/v2.10.1...v2.11.0) (2026-06-08)


### Features

* **camera:** UX 对齐(ultra-wide/aspect/去网格)+ 下方返回改 undo ([#54](https://github.com/unif-design/react-native-camera/issues/54)) ([7e32e61](https://github.com/unif-design/react-native-camera/commit/7e32e61876dc43f83eefd52f3ee2a925a01f1b02))

## [2.10.1](https://github.com/unif-design/react-native-camera/compare/v2.10.0...v2.10.1) (2026-06-08)

# [2.10.0](https://github.com/unif-design/react-native-camera/compare/v2.9.0...v2.10.0) (2026-06-08)


### Features

* **llms:** sync generator (index desc/TOC/LiveDemo/order) ([#45](https://github.com/unif-design/react-native-camera/issues/45)) ([2f44f9a](https://github.com/unif-design/react-native-camera/commit/2f44f9afb89fc3f59512beb1711ff002c0e028ab))
* **ui:** 预览统一黑底 + 主界面左侧返回/保存 + 上下安全区适配 ([#51](https://github.com/unif-design/react-native-camera/issues/51)) ([7057f4b](https://github.com/unif-design/react-native-camera/commit/7057f4bfabf9210d25feadde618206d9552c76ca))

# [2.9.0](https://github.com/unif-design/react-native-camera/compare/v2.8.3...v2.9.0) (2026-06-03)


### Bug Fixes

* **website:** build-llms review 加固 + 建 CLAUDE.md [@import](https://github.com/import) AGENTS.md ([#37](https://github.com/unif-design/react-native-camera/issues/37)) ([ea73de2](https://github.com/unif-design/react-native-camera/commit/ea73de2f49690ae8ae27f5c9ad56a6f9d50f82a2))
* **website:** build-llms 升 path.resolve 路径遍历加固 ([#36](https://github.com/unif-design/react-native-camera/issues/36)) ([dc48aed](https://github.com/unif-design/react-native-camera/commit/dc48aed0b4ce72257c1ef7cf1e84c2381e51376d))


### Features

* **camera:** UI 对齐设计原型 + 弹性布局重构 + 修两个 bug ([#43](https://github.com/unif-design/react-native-camera/issues/43)) ([69c3496](https://github.com/unif-design/react-native-camera/commit/69c349663b8bed2513b6dbf3772078f15f2c348a))
* **website:** camera 站首页重构(代码+取景器 hero) ([#39](https://github.com/unif-design/react-native-camera/issues/39)) ([b17ad33](https://github.com/unif-design/react-native-camera/commit/b17ad33cd91b78614494c82e2847e3bda909b963))
* **website:** llms.txt 标准化(复制 design build-llms) ([#34](https://github.com/unif-design/react-native-camera/issues/34)) ([5618f30](https://github.com/unif-design/react-native-camera/commit/5618f30c01b17fc52252504b834325d54e5858df))

## [2.8.3](https://github.com/unif-design/react-native-camera/compare/v2.8.2...v2.8.3) (2026-06-02)

## [2.8.2](https://github.com/unif-design/react-native-camera/compare/v2.8.1...v2.8.2) (2026-06-02)


### Bug Fixes

* **camera:** use maintained [@dr](https://github.com/dr).pogodin/react-native-fs fork ([#28](https://github.com/unif-design/react-native-camera/issues/28)) ([add5611](https://github.com/unif-design/react-native-camera/commit/add5611a33c6cfc19da2f0bc77e5e85400899f7e))

## [2.8.1](https://github.com/unif-design/react-native-camera/compare/v2.8.0...v2.8.1) (2026-06-02)


### Bug Fixes

* **camera:** dispose Skia objects + burn watermark per-shot (continuous memory/perf) ([#27](https://github.com/unif-design/react-native-camera/issues/27)) ([7e4e8d4](https://github.com/unif-design/react-native-camera/commit/7e4e8d415854f6339951108e0b89d1fe37da028a))

# [2.8.0](https://github.com/unif-design/react-native-camera/compare/v2.7.0...v2.8.0) (2026-06-01)


### Features

* camera watermark — burn into photo on save (Phase 2c) ([#26](https://github.com/unif-design/react-native-camera/issues/26)) ([967fbaa](https://github.com/unif-design/react-native-camera/commit/967fbaa4b23ba6aa7cb7160980dd27603d590bd8))

# [2.7.0](https://github.com/unif-design/react-native-camera/compare/v2.6.1...v2.7.0) (2026-06-01)


### Bug Fixes

* **2a:** clamp zoom-chip selection to device zoom range ([ade2dc1](https://github.com/unif-design/react-native-camera/commit/ade2dc19c777e75c2df5b23319e52f565b949c61))
* **2b:** migrate VideoPlayer to react-native-video 7.x API ([4dd9cbc](https://github.com/unif-design/react-native-camera/commit/4dd9cbcbdc10b4b4f0634f20f2220886aaeec2e1))
* **2b:** reconcile preview activeType/index on delete; drop unused useConfirm ([698623e](https://github.com/unif-design/react-native-camera/commit/698623e26204e932b9797ceb93b703d381a5e8cc))


### Features

* **2a:** action row (thumbnail/back/shutter/save/flip) ([438992d](https://github.com/unif-design/react-native-camera/commit/438992d85aaf185c42818289db1720d1e36c9ced))
* **2a:** add fixed-dark color constants for viewfinder ([8350c59](https://github.com/unif-design/react-native-camera/commit/8350c598099f9872b56cb8b25b59531f6f441f01))
* **2a:** capture flash overlay and reworked focus indicator ([76b1610](https://github.com/unif-design/react-native-camera/commit/76b1610e8932edaf28b3e8b57f2462da2c52dd84))
* **2a:** flip button and zoom chips ([ca8d32f](https://github.com/unif-design/react-native-camera/commit/ca8d32f659c2fc4c8bbef05ea8846c4b82762a3c))
* **2a:** inline VolumeIcon SVG + jest svg mock ([a18c6e5](https://github.com/unif-design/react-native-camera/commit/a18c6e5cae0d33f59cca6511aa52f417b2d0f295))
* **2a:** mode switcher pill with orange sliding indicator ([8b8c769](https://github.com/unif-design/react-native-camera/commit/8b8c769ca0edee04a760712972d8c8975a1c105d))
* **2a:** multi-state shutter component ([e9731a6](https://github.com/unif-design/react-native-camera/commit/e9731a6742122b239e44654550aa8dc5ae327fe0))
* **2a:** recording timer with MM:SS + blink dot ([ab6162c](https://github.com/unif-design/react-native-camera/commit/ab6162c2c9300a5e08ae441ed1596632d3a031ef))
* **2a:** thumbnail stack with orange count badge ([bfb5280](https://github.com/unif-design/react-native-camera/commit/bfb5280735dc93bbbe017c783d6c7db0740ebcdc))
* **2a:** vertical side rail with flash dropdown ([2f7b1d2](https://github.com/unif-design/react-native-camera/commit/2f7b1d2585f84be48530d55e81918bd3e132cc00))
* **2a:** wire new viewfinder chrome, runtime flip, save/back, auto-preview rule ([4bba6a8](https://github.com/unif-design/react-native-camera/commit/4bba6a8e31205390848f37f73cf38a42e97452b6))
* **2a:** wire shutter sound, grid overlay, and flip animation in Camera ([f78d569](https://github.com/unif-design/react-native-camera/commit/f78d5691de2dc360c7defffeaceacc189176c796))
* **2b:** groupTypes helpers (distinct types + filter) ([b7ec816](https://github.com/unif-design/react-native-camera/commit/b7ec8160852f66b732f1cd82d2521fa20d661f77))
* **2b:** preview bottom bar (counter + variant buttons) ([8745b38](https://github.com/unif-design/react-native-camera/commit/8745b38246044a0c2ddbef299da466eafeb7a835))
* **2b:** preview overlay (variant routing + tabs + carousel + confirm/toast) ([50b5131](https://github.com/unif-design/react-native-camera/commit/50b51316f0afb6c6939794f25133e751a491427f))
* **2b:** preview top bar (label / total / type tabs) ([664eaa9](https://github.com/unif-design/react-native-camera/commit/664eaa92d54f25eb86cd9d4b06a89d402dbc689b))
* **2b:** slide item renders video player for video files ([8dfb153](https://github.com/unif-design/react-native-camera/commit/8dfb153a6b51e78bae7cb12e1147575cb513da58))
* **2b:** video player (react-native-video, tap to play/pause) ([fc1efa5](https://github.com/unif-design/react-native-camera/commit/fc1efa5d81968eff4d092a42312cc2f463d51576))
* **2b:** wire preview overlay with confirm/gallery variants and remove old preview tree ([2f51716](https://github.com/unif-design/react-native-camera/commit/2f5171666a68cb3522bef7e497cc1d48f25a4c7f))

## [2.6.1](https://github.com/unif-design/react-native-camera/compare/v2.6.0...v2.6.1) (2026-05-31)


### Bug Fixes

* declare react-native-vision-camera-worklets peer dependency ([#19](https://github.com/unif-design/react-native-camera/issues/19)) ([ef27ce3](https://github.com/unif-design/react-native-camera/commit/ef27ce376cc5f611daa4001da6b487a7ec6e30fc))

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
