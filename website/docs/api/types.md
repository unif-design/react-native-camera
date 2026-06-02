---
sidebar_position: 3
title: 类型
description: "@unif/react-native-camera 所有公开类型的完整定义——OpenConfig、CameraMode、CameraResult、CustomPhotoFile。"
---

# 类型

`@unif/react-native-camera` 所有公开类型的完整定义。

---

## 引用

```ts
import type {
  OpenConfig,
  CameraMode,
  CameraResult,
  CustomPhotoFile,
  CameraApi,
  WatermarkType,
} from '@unif/react-native-camera';
```

---

## OpenConfig

传入 [`api.open(config)`](/docs/api/camera-api#openconfig-openconfig-promisecameraresult) 的配置对象。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `cameraMode` | `CameraMode[]` | ✅ | 至少一项；多项时底部出现模式 tab |
| `dataRetainedMode` | `'clear' \| 'retain'` | ✅ | 模式切换时是否保留已拍照片 |
| `watermark` | `WatermarkType` | — | 水印配置；传入则取景显示戳记 + 保存时烧入成片。详见[水印指南](/docs/guides/watermark) |

---

## WatermarkType

`OpenConfig.watermark` 的类型——给取景画面和成片烧入文字水印。水印用法见[水印指南](/docs/guides/watermark)。

| 字段 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `content` | `string[]` | ✅ | — | 水印文字，每行一条；数量不限 |
| `position` | `'top-left' \| 'top-center' \| 'top-right' \| 'bottom-left' \| 'bottom-center' \| 'bottom-right'` | — | `'top-right'` | 水印位置 |

---

## CameraMode

`OpenConfig.cameraMode` 数组中每一项的类型，描述一种拍摄模式及其初始参数。

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `type` | `'back' \| 'front'` | `back` | 初始前/后摄 |
| `flashMode` | `'auto' \| 'on' \| 'off'` | — | 初始闪光（保留作兼容；闪光实际由相机内 UI 控制） |
| `mode` | `'single' \| 'continuous' \| 'video'` | — | 拍摄模式（**必填**） |
| `quality` | `number` | `0.9` | JPEG 压缩 0~1 |
| `recTime` | `number` | — | 录制时长上限（秒，video 模式） |

---

## CameraResult

[`api.open()`](/docs/api/camera-api) 返回的 `Promise` resolve 值。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `code` | `0 \| 200 \| 403 \| 404 \| 500 \| 503` | 状态码，见下表 |
| `data` | `CustomPhotoFile[]` | 拍摄的文件列表 |
| `message` | `string` | 描述信息 |

**状态码说明：**

| code | 含义 |
| --- | --- |
| `200` | 用户完成拍摄并确认，`data` 包含文件列表 |
| `0` | 用户取消（未拍或点击返回） |
| `403` | 没有相机权限 |
| `404` | 没有可用摄像设备 |
| `500` | 拍照失败 |
| `503` | 录像失败 |

---

## CustomPhotoFile

`CameraResult.data` 数组中每个文件的类型。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 唯一 id（时间戳 + 序号） |
| `cameraType` | `'back' \| 'front'` | 拍摄时的前/后摄 |
| `cameraMode` | `'single' \| 'continuous' \| 'video'` | 模式（原版字段名，= `mode`） |
| `path` | `string` | 本地文件路径 |
| `uri` | `string` | 文件 uri（`file://`） |
| `width` | `number` | 宽（px） |
| `height` | `number` | 高（px） |
| `mime` | `'image/jpeg' \| 'video/mp4'` | MIME 类型 |
| `mode` | `'single' \| 'continuous' \| 'video'` | 模式（2.x 字段名，= `cameraMode`） |
| `duration?` | `number` | 时长（秒，仅 video） |

:::info cameraMode 与 mode 的关系
`cameraMode` 与 `mode` 是**同一字段的两个别名**，值始终相同：`cameraMode` 是原版（1.x）字段名，`mode` 是 2.x 引入的字段名。两者同时存在以保证向后兼容，消费者按习惯选用其中一个即可。
:::

---

## 平台兼容性

类型定义在所有平台均可使用（不含运行时代码）。

| 平台 | 支持 |
| --- | --- |
| iOS | ✅ |
| Android | ✅ |
| Web | ✅ |

---

## 相关

- [useCamera](/docs/api/use-camera) — 获取 `CameraApi` 实例的 hook
- [CameraApi](/docs/api/camera-api) — `open()` / `close()` 方法文档
- [拍照](/docs/guides/taking-photos) — 拍照场景配置示例
- [录像](/docs/guides/recording-video) — 录像场景配置示例
