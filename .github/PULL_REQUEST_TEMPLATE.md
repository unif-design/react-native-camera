## 变更概述

<!-- 1-2 句:做了什么 / 为什么。链接 issue 用 `Closes #N`。 -->

## 类型

<!-- conventional-commits 类型,跟 commit msg 对齐。多选用 - [x] -->

- [ ] `feat` 新功能(会触发 minor 发版)
- [ ] `fix` Bug 修复(会触发 patch 发版)
- [ ] `refactor` / `chore` / `docs` / `test` / `ci`(不发版)
- [ ] **包含 BREAKING CHANGE**(会触发 major 发版,在 commit body 写 `BREAKING CHANGE: ...`)

## 验证

- [ ] `yarn lint`
- [ ] `yarn typecheck`
- [ ] `yarn test`
- [ ] (若改了 vision-camera API 调用)真机上 iOS / Android 跑过 `yarn example`
- [ ] (若改了 peer deps)消费方(retail-pecportal)兼容性已确认
- [ ] (若改了公开 API)README 已更新

## 影响范围 / 注意点

<!-- 改动是否破坏 useCamera() 公开 API / 是否影响消费方 / 是否需要同步 design 仓库 -->
