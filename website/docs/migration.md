---
sidebar_position: 7
title: 从 v1.x 升级
description: "@unif/react-native-camera v2.0.0 破坏性变更清单及迁移方法。"
---

# 从 v1.x 升级

## v2.0.0 破坏性变更

### 1. 移除 `photoResolution` / `videoResolution` → 改用 `quality`

`CameraMode` 的 `photoResolution` 和 `videoResolution` 字段已移除，统一改用 `quality`（`0~1` 的 JPEG 压缩系数）控制输出质量：

```ts
// v1.x（已移除）
{ mode: 'single', photoResolution: '4k' }

// v2.x
{ mode: 'single', quality: 0.9 }
```

---

### 2. 移除 `watermark` 配置项（v2.1.x 已重新加入）

`open()` 的 `watermark` 参数在 `v2.0.0` 中被移除。该功能已在 **v2.1.x** 重新加入并增强，现支持多行文字、六方位对齐与 Skia 离屏合成。

迁移方式：升级到 `v2.1.x` 或更高版本，并参照[指南 → 水印](./guides/watermark)的新 API 传参。

---

### 3. 类型从顶层入口导入

v1.x 部分类型需要通过 deep path 导入：

```ts
// v1.x（已废弃）
import type { CameraResult } from '@unif/react-native-camera/lib/typescript/src/utils';

// v2.x：直接从顶层入口导入
import type { CameraResult, OpenConfig, CameraMode } from '@unif/react-native-camera';
```

所有公开类型现已从 `@unif/react-native-camera` 顶层统一导出，无需任何 deep path。完整类型列表见 [API 参考 → 类型](./api/types)。
