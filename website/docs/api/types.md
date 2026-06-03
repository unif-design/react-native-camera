---
sidebar_position: 3
title: 类型
description: "@unif/react-native-camera 公开类型完整参考：OpenConfig、CameraMode、WatermarkType、CameraResult（状态码 200/0/403/404/500/503）、CustomPhotoFile 字段表。"
---

# 类型

`@unif/react-native-camera` 所有公开类型的完整定义，逐字段（prop · 类型 · 默认 · 说明）列出。类型从 `@unif/react-native-camera` 直接导出。

---

## 引用 {#import}

```ts
import type {
  OpenConfig,
  CameraMode,
  WatermarkType,
  CameraResult,
  CustomPhotoFile,
  CameraApi,
} from '@unif/react-native-camera';
```

---

## OpenConfig {#openconfig}

传入 [`api.open(config)`](/docs/api/camera-api#open) 的配置对象。

| 字段 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `cameraMode` | [`CameraMode[]`](#cameramode) | ✅ | — | 拍摄模式数组，至少一项；多项时底部出现模式 tab |
| `dataRetainedMode` | `'clear' \| 'retain'` | ✅ | — | 切换模式时是否保留已拍照片 |
| `watermark` | [`WatermarkType`](#watermarktype) | — | 不加水印 | 文字水印配置；传入则取景显示戳记 + 保存时烧入成片 |

各字段的运行时行为见 [CameraApi → OpenConfig](/docs/api/camera-api#openconfig)。

---

## CameraMode {#cameramode}

`OpenConfig.cameraMode` 数组中每一项的类型，描述一种拍摄模式及其初始参数。

| 字段 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `mode` | `'single' \| 'continuous' \| 'video'` | ✅ | — | 拍摄模式：单拍 / 连拍 / 视频 |
| `type` | `'back' \| 'front'` | — | `'back'` | 初始前/后摄。**仅数组首项生效**（决定相机打开时的初始镜头） |
| `flashMode` | `'auto' \| 'on' \| 'off'` | — | `'off'` | 初始闪光。**仅数组首项生效**作初始值；闪光开关之后由相机内 UI 控制 |
| `quality` | `number` | — | `0.9` | JPEG 压缩率 `0~1`（内部速度优先级写死 `'speed'`） |
| `recTime` | `number` | — | — | 录制时长上限（秒）。**当前为类型保留字段，源码未接线（no-op）**，不会自动停止录制 |

:::note `type` / `flashMode` / `recTime` 的现状
这三个字段沿用自原版 4.x 的 API，类型签名保留以向后兼容：

- `type`、`flashMode` 仅**数组首项**被读取，作相机打开时的初始镜头 / 初始闪光；其余项的这两个字段被忽略。
- `recTime` 目前在源码中**未被消费**（no-op），传入不会限制录制时长。需要时长上限请在业务侧自行处理。
:::

---

## WatermarkType {#watermarktype}

`OpenConfig.watermark` 的类型——给取景画面和成片烧入文字水印。用法见 [水印指南](/docs/guides/watermark)。

| 字段 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `content` | `string[]` | ✅ | — | 水印文字，每个字符串一行；数量不限 |
| `position` | `'top-left' \| 'top-center' \| 'top-right' \| 'bottom-left' \| 'bottom-center' \| 'bottom-right'` | — | `'top-right'` | 水印位置（文字对齐随位置自适应） |

---

## CameraResult {#cameraresult}

[`api.open()`](/docs/api/camera-api#open) 返回的 `Promise` resolve 值。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `code` | `0 \| 200 \| 403 \| 404 \| 500 \| 503` | 状态码，见下表 |
| `data` | [`CustomPhotoFile[]`](#customphotofile) | 拍摄的文件列表（仅 `code === 200` 时非空有效） |
| `message` | `string` | 描述信息 |

**状态码（`CameraResultCode`）：**

| code | 含义 | 何时返回 |
| --- | --- | --- |
| `200` | 成功 | 用户完成拍摄并确认，`data` 含文件列表 |
| `0` | 取消 | 用户取消、点返回或调用 `api.close()`（`data` 为空） |
| `403` | 无权限 | 相机权限被拒 |
| `404` | 无设备 | 没有可用摄像设备 |
| `500` | 拍摄失败 | 拍照失败，或 `cameraMode` 配置非法（如空数组 / 无效项） |
| `503` | 录像失败 | 视频录制失败 |

:::warning 判成功务必 `=== 200`
只有 `200` 是成功。`0` 是取消，此时 `data` 为空——别把取消当成功。
:::

---

## CustomPhotoFile {#customphotofile}

`CameraResult.data` 数组中每个文件的类型。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 唯一 id（`时间戳-序号`，避免同毫秒撞 id） |
| `cameraType` | `'back' \| 'front'` | 拍摄时的前/后摄 |
| `cameraMode` | `'single' \| 'continuous' \| 'video'` | 模式（原版 1.x 字段名，= `mode`） |
| `path` | `string` | 本地文件路径 |
| `uri` | `string` | 文件 uri（`file://` 前缀） |
| `width` | `number` | 宽（px） |
| `height` | `number` | 高（px） |
| `mime` | `'image/jpeg' \| 'video/mp4'` | MIME 类型 |
| `mode` | `'single' \| 'continuous' \| 'video'` | 模式（2.x 字段名，= `cameraMode`） |
| `duration?` | `number` | 时长（秒，仅 video 条目有，取录制实际时长） |

:::info `cameraMode` 与 `mode` 的关系
`cameraMode` 与 `mode` 是**同一值的两个别名**，始终相等：`cameraMode` 是原版（1.x）字段名，`mode` 是 2.x 引入的字段名。两者同时存在以保证向后兼容，按习惯选用其一即可。
:::

---

## CameraApi {#cameraapi}

[`useCamera()`](/docs/api/use-camera) 返回的相机控制对象。逐方法说明见 [CameraApi](/docs/api/camera-api)。

```ts
type CameraApi = {
  open: (config: OpenConfig) => Promise<CameraResult>;
  close: () => void;
};
```

---

## 平台兼容性 {#platforms}

类型定义为纯 TypeScript（不含运行时代码），在所有平台均可导入。

| 平台 | 支持 |
| --- | --- |
| iOS | ✅ |
| Android | ✅ |
| Web | ✅（仅类型） |

---

## 相关 {#related}

- [useCamera](/docs/api/use-camera) — 获取 `CameraApi` 实例的 hook
- [CameraApi](/docs/api/camera-api) — `open()` / `close()` 方法与 `OpenConfig` 行为
- [拍照](/docs/guides/taking-photos) — 拍照场景配置示例
- [录像](/docs/guides/recording-video) — 录像场景配置示例
