---
sidebar_position: 2
title: 快速上手
description: 用 useCamera 5 分钟跑通第一次拍照。
---

# 快速上手

本页展示最小可运行示例，帮你在 5 分钟内完成第一次拍照。

:::warning 真机验证
相机功能依赖原生摄像头，**无法在模拟器中预览实际效果**。请在真机上验证完整行为。
:::

---

## 最小示例

```tsx
import React from 'react';
import { View, Text } from 'react-native';
import { useCamera } from '@unif/react-native-camera';

const App = () => {
  const [api, holder] = useCamera();

  return (
    <View>
      <Text
        onPress={async () => {
          const res = await api.open({
            cameraMode: [
              { mode: 'single', quality: 0.9 },
              { mode: 'continuous' },
            ],
            dataRetainedMode: 'clear',
          });
          // res.code: 200=ok, 0=cancelled, 403=no_permission, 404=no_device, 500=capture_failed, 503=video_failed
          if (res.code === 200) {
            // res.data 是拍摄的文件列表(CustomPhotoFile[])
          }
        }}
      >
        打开相机
      </Text>
      {holder}
    </View>
  );
};

export default App;
```

---

## 逐行讲解

### 1. 初始化 hook

```tsx
const [api, holder] = useCamera();
```

`useCamera()` 返回一个二元组：

- **`api`**：`CameraApi` 对象，提供 `open()` / `close()` 方法，用于控制相机的打开和关闭。
- **`holder`**：`React.ReactElement`，相机的 React 宿主节点，**必须渲染进 React 树**（见下方 `{holder}`）。`holder` 是相机 UI 的挂载点，缺少它则相机无法显示。

### 2. 打开相机

```tsx
const res = await api.open({
  cameraMode: [
    { mode: 'single', quality: 0.9 },
    { mode: 'continuous' },
  ],
  dataRetainedMode: 'clear',
});
```

`api.open(config)` 返回一个 `Promise<CameraResult>`，在用户完成拍摄并确认（或取消）后 resolve：

- **`cameraMode`**：拍摄模式数组，至少一项。本例提供两项（单拍 + 连拍），相机底部会出现模式 tab 供用户切换。
  - `mode: 'single'` — 单次拍摄，`quality: 0.9` 设置 JPEG 压缩率（0~1）。
  - `mode: 'continuous'` — 连续拍摄多张。
- **`dataRetainedMode: 'clear'`** — 用户切换拍摄模式时，清除已拍照片。改为 `'retain'` 则保留。

### 3. 处理返回结果

```tsx
// res.code: 200=ok, 0=cancelled, 403=no_permission, 404=no_device, 500=capture_failed, 503=video_failed
if (res.code === 200) {
  // res.data 是拍摄的文件列表(CustomPhotoFile[])
}
```

`res` 是 `CameraResult`，根据 `res.code` 判断结果：

| code | 含义 |
| --- | --- |
| `200` | 用户完成拍摄并确认，`res.data` 包含文件列表 |
| `0` | 用户取消（未拍或点击返回） |
| `403` | 没有相机权限 |
| `404` | 没有可用摄像设备 |
| `500` | 拍照失败 |
| `503` | 录像失败 |

### 4. 渲染 holder

```tsx
{holder}
```

`holder` **必须出现在 React 树中**，这是相机 UI（全屏模态）的挂载宿主。位置不影响视觉——相机打开时会全屏覆盖，但节点必须存在，否则 `api.open()` 调用无效。

---

## 下一步

- [指南 → 拍照](/docs/guides/taking-photos) — 深入了解单拍 / 连拍配置与预览
- [API 参考 → useCamera](/docs/api/use-camera) — `useCamera` 完整 API 文档
