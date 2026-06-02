---
sidebar_position: 2
title: CameraApi
description: 相机控制对象，提供打开相机和关闭相机两个方法。
---

# CameraApi

相机控制对象，提供打开相机和关闭相机两个方法。通过 [`useCamera()`](/docs/api/use-camera) hook 获取。

---

## 引用 / 签名

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

## 方法

### `open(config: OpenConfig): Promise<CameraResult>`

打开相机模态。用户完成拍摄并确认（或取消）后，Promise resolve 为 [`CameraResult`](/docs/api/types#cameraresult)。

**签名：**

```ts
open(config: OpenConfig): Promise<CameraResult>
```

**参数：**

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `config` | `OpenConfig` | 相机配置，包括拍摄模式、数据保留策略、水印等 |

详见 [`OpenConfig`](/docs/api/types#openconfig) 类型定义。

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

### `close(): void`

关闭相机模态（如果当前处于打开状态）。通常情况下无需手动调用——用户拍摄完成或取消后 `open()` 会自动 resolve 并关闭相机。在需要从外部强制关闭相机时使用（例如导航拦截）。

**签名：**

```ts
close(): void
```

**示例：**

```tsx
// 导航离开时强制关闭
useEffect(() => {
  return () => {
    api.close();
  };
}, [api]);
```

---

## 平台兼容性

| 平台 | 支持 |
| --- | --- |
| iOS | ✅ |
| Android | ✅ |
| Web | ❌ |

---

## 相关

- [useCamera](/docs/api/use-camera) — 获取 `CameraApi` 实例的 hook
- [类型](/docs/api/types) — `OpenConfig` / `CameraResult` / `CustomPhotoFile` 类型定义
- [拍照](/docs/guides/taking-photos) — 拍照场景完整指南
- [录像](/docs/guides/recording-video) — 录像场景完整指南
