---
sidebar_position: 2
title: CameraApi
description: "CameraApi 相机控制对象：open(config) 弹出全屏相机并 resolve Promise<CameraResult>，close() 强制关闭；含 OpenConfig 配置说明。"
---

# CameraApi

相机控制对象，由 [`useCamera()`](/docs/api/use-camera) 返回，提供**打开 / 关闭相机**两个方法。这是一套 Promise 式弹窗相机 API：`open()` 弹出全屏相机，用户拍完确认（或取消）后 Promise resolve 出 [`CameraResult`](/docs/api/types#cameraresult)。

---

## 引用 / 签名 {#signature}

```ts
import { useCamera } from '@unif/react-native-camera';
import type { CameraApi } from '@unif/react-native-camera';
```

```ts
const [api, holder] = useCamera();
// api 的类型为 CameraApi
```

**TypeScript 签名：**

```ts
type CameraApi = {
  open: (config: OpenConfig) => Promise<CameraResult>;
  close: () => void;
};
```

---

## `open(config)` {#open}

```ts
open(config: OpenConfig): Promise<CameraResult>
```

弹出相机全屏模态。用户在模态内完成拍摄 → 预览确认 / 取消后，Promise resolve 为 [`CameraResult`](/docs/api/types#cameraresult)。**取消不会 reject**——而是 resolve 出 `code: 0`。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `config` | [`OpenConfig`](#openconfig) | ✅ | 相机配置——拍摄模式、数据保留策略、水印 |

**示例：**

```tsx
const res = await api.open({
  cameraMode: [
    { mode: 'single', quality: 0.9 },
    { mode: 'continuous' },
  ],
  dataRetainedMode: 'clear',
});
if (res.code === 200) {
  // res.data 是 CustomPhotoFile[] 文件列表
}
```

---

## `close()` {#close}

```ts
close(): void
```

强制关闭相机模态（若当前处于打开状态）。内部等价于以 `code: 0`（`message: 'cancelled'`）settle 当前 `open()` 的 Promise。

**通常无需手动调用**——用户拍摄完成或取消后 `open()` 会自动 resolve 并关闭相机。仅在需要从外部强制收起相机时使用（例如路由拦截、用户登出）。

**示例：**

```tsx
// 组件卸载时兜底关闭相机
useEffect(() => {
  return () => {
    api.close();
  };
}, [api]);
```

---

## OpenConfig {#openconfig}

`open()` 的配置对象。完整字段类型表见 [类型 → OpenConfig](/docs/api/types#openconfig)，这里说明各字段的**运行时行为**：

| 字段 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `cameraMode` | [`CameraMode[]`](/docs/api/types#cameramode) | ✅ | — | 拍摄模式数组，至少一项 |
| `dataRetainedMode` | `'clear' \| 'retain'` | ✅ | — | 切换模式时是否保留已拍文件 |
| `watermark` | [`WatermarkType`](/docs/api/types#watermarktype) | — | 不加水印 | 文字水印配置 |

### `cameraMode` {#cameramode-behavior}

- **数组的首项决定初始状态**：初始前/后摄取首项的 `type`（缺省 `back`），初始闪光取首项的 `flashMode`（缺省 `off`）；其余项的 `type` / `flashMode` 不影响初始化。
- **多项时底部出现模式 tab**：相机底部按数组顺序渲染「单拍 / 连拍 / 视频」切换 pill，用户拍摄过程中可自由切换。仅一项时不显示 tab。
- 每项的 `mode`、`quality` 等字段见 [`CameraMode`](/docs/api/types#cameramode)。

### `dataRetainedMode` {#dataretainedmode-behavior}

控制用户**切换拍摄模式**时已拍文件的去留，并影响单拍的自动预览时机：

| 值 | 行为 |
| --- | --- |
| `'clear'` | 切模式时先 `confirm()` 二次确认，确认后清空已拍照片；且「**单拍 + clear**」每拍一张后直接进入确认预览页 |
| `'retain'` | 切模式时不清空，已拍文件累积合并进最终结果 |

### `watermark` {#watermark-behavior}

传入则**取景画面实时显示水印戳记**（WYSIWYG），**保存时把水印离屏烧入成片**。仅对照片（`image/jpeg`）生效，录像无水印。详见 [水印指南](/docs/guides/watermark)。

---

## 平台兼容性 {#platforms}

| 平台 | 支持 |
| --- | --- |
| iOS | ✅ |
| Android | ✅ |
| Web | ❌ |

---

## 相关 {#related}

- [useCamera](/docs/api/use-camera) — 获取 `CameraApi` 实例的 hook
- [类型](/docs/api/types) — `OpenConfig` / `CameraResult` / `CustomPhotoFile` 完整字段表
- [拍照](/docs/guides/taking-photos) — 拍照场景完整指南
- [录像](/docs/guides/recording-video) — 录像场景完整指南
