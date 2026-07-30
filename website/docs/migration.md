---
sidebar_position: 7
title: 版本迁移
description: "@unif/react-native-camera v3.0.0 的原生动画依赖升级，以及 v1.x → v2.x 的 API 迁移方法。"
---

# 版本迁移

## 从 v2.x 升级到 v3.0

v3.0 将预览轮播迁移到 stable Carousel 5，并统一使用 Gesture Handler 3、
Reanimated 4.5 与 Worklets 0.11。`useCamera()` 等公开业务 API 不变，但原生动画 peers
必须作为一个兼容组合原子升级。

| peer | v2.x | v3.0 |
| --- | --- | --- |
| `react-native-gesture-handler` | `>=2.21.0` | `>=3.0.0 <4.0.0` |
| `react-native-reanimated` | `>=4.0.0` | `>=4.5.0 <4.6.0` |
| `react-native-worklets` | `*` | `>=0.11.0 <0.12.0` |
| `react-native-reanimated-carousel` | `>=5.0.0-beta.0` | `>=5.0.0 <6.0.0` |
| `@unif/react-native-design` | `>=0.8.1` | `>=0.20.0` |

使用 Yarn 可直接执行:

```sh
yarn add @unif/react-native-camera@^3.0.0 \
  @unif/react-native-design@^0.20.0 \
  react-native-gesture-handler@^3.1.0 \
  react-native-reanimated@^4.5.3 \
  react-native-worklets@^0.11.3 \
  react-native-reanimated-carousel@^5.0.0
```

使用 npm 时，Carousel 5.0.0 的上游 peer 范围尚未包含 Gesture Handler 3。
请先在消费端根 `package.json` 加入仅作用于 Carousel 的 scoped override:

```json
{
  "overrides": {
    "react-native-reanimated-carousel": {
      "react-native-gesture-handler": "$react-native-gesture-handler"
    }
  }
}
```

然后执行:

```sh
npm install @unif/react-native-camera@^3.0.0 \
  @unif/react-native-design@^0.20.0 \
  react-native-gesture-handler@^3.1.0 \
  react-native-reanimated@^4.5.3 \
  react-native-worklets@^0.11.3 \
  react-native-reanimated-carousel@^5.0.0
```

不要使用全局 override、`--force` 或 `--legacy-peer-deps`。

升级原生依赖后，iOS 重新安装 Pods:

```sh
cd ios
bundle exec pod install
```

Android 请重新 clean/build 应用；若 Metro 仍引用旧动画模块，再清理 Metro cache。

---

## 从 v1.x 升级到 v2.x

v1.x → v2.x 的破坏性变更清单与迁移方法。当前最新版的完整 API 见 [API 参考](/docs/api/use-camera)。

---

### 1. `photoResolution` / `videoResolution` → 改用 `quality`

`CameraMode` 的 `photoResolution` 和 `videoResolution` 字段已移除,统一改用 `quality`(`0~1` 的 JPEG 压缩系数,默认 `0.9`)控制输出质量:

```ts
// ❌ v1.x(已移除)
{ mode: 'single', photoResolution: '4k' }

// ✅ v2.x
{ mode: 'single', quality: 0.9 }
```

---

### 2. `watermark` 配置项:移除后又回归

`api.open()` 的 `watermark` 参数在 **v2.0.0** 中一度被移除,已在 **v2.1.x** 重新加入并增强:现支持多行文字(`content: string[]`)、六方位对齐(`position`)与 Skia 离屏合成。

迁移方式:升级到 `v2.1.x` 或更高版本,参照[指南 → 水印](/docs/guides/watermark)的新 API 传参。注意水印**仅对照片生效,录像无水印**。

---

### 3. 类型改从顶层入口导入

v1.x 部分类型需通过 deep path 导入;v2.x 起所有公开类型都从 `@unif/react-native-camera` 顶层统一导出:

```ts
// ❌ v1.x(已废弃的 deep path)
import type { CameraResult } from '@unif/react-native-camera/lib/typescript/src/utils';

// ✅ v2.x:直接从顶层入口导入
import type { CameraResult, OpenConfig, CameraMode } from '@unif/react-native-camera';
```

无需任何 deep path。完整类型列表见 [API 参考 → 类型](/docs/api/types)。

---

## 下一步

- [安装](/docs/getting-started/installation) —— 确认新版 peerDeps 装齐(v2 及以上仅支持新架构)
- [核心概念](/docs/getting-started/concepts) —— 模态相机心智模型
- [API 参考 → 类型](/docs/api/types) —— 当前版本的完整类型定义
