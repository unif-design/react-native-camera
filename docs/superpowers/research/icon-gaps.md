# Camera 仓库 icon 缺口（已解决 ✅）

整理时间：2026-05-26（Phase 2 改造期）
解决时间：2026-05-27（design 0.2.0 发布）

## 状态

`@unif/react-native-design@0.2.0` 已补齐以下 11 个 icon + `Empty.icon?: IconName` prop：

- ✅ shutter, shutter-recording
- ✅ flash-on, flash-off, flash-auto
- ✅ aspect-4-3, aspect-16-9
- ✅ lens-flip
- ✅ camera-flip, camera-off
- ✅ permission-denied, lock
- ✅ error-alert

## 后续清理

camera 仓库已在 commit `ecc6048` 中：
1. 升级 `@unif/react-native-design` 从 `portal:` 切到 `^0.2.0`
2. NoPermission/NoCamera/Error 三个 Empty 加专属 icon
3. SetUp 三个 Chip 加 leading Icon

本文件保留为历史记录，不再代表 active gap。
