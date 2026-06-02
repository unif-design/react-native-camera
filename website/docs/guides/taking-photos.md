---
sidebar_position: 1
title: 拍照
description: 单拍、连拍与质量控制——覆盖拍照场景的完整配置指南。
---

# 拍照并保存

本页介绍如何配置 `@unif/react-native-camera` 完成拍照任务——包括最简单的单张拍摄、连续抓拍多张、JPEG 质量控制，以及同时提供多种拍摄模式时的 tab 切换行为。

---

## 基本用法

最简场景：单拍模式，用户拍一张后确认返回。

```tsx
import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useCamera } from '@unif/react-native-camera';

const PhotoScreen = () => {
  const [api, holder] = useCamera();

  const handleCapture = async () => {
    const res = await api.open({
      cameraMode: [{ mode: 'single' }],
      dataRetainedMode: 'clear',
    });
    if (res.code === 200) {
      // res.data: CustomPhotoFile[] — 处理拍摄结果
    }
  };

  return (
    <View>
      <TouchableOpacity onPress={handleCapture}>
        <Text>拍照</Text>
      </TouchableOpacity>
      {holder}
    </View>
  );
};
```

**逐行讲解：**

- `cameraMode: [{ mode: 'single' }]` — 传入只含 `single` 的数组，相机底部不出现 tab，用户每次按快门拍一张，点「确认」后 `open()` resolve。
- `dataRetainedMode: 'clear'` — 此处只有一个模式，值对单模式无实际影响；多模式时才有意义（见下方）。
- `res.code === 200` — 用户完成确认；`0` 表示取消，其余错误码见 [API 参考 → CameraResult](/docs/api/types#cameraresult)。

---

## 连拍

将 `mode` 改为 `'continuous'`，用户可连续按快门拍多张，相机持续显示缩略图条，最终一次性确认所有照片。

```tsx
const res = await api.open({
  cameraMode: [{ mode: 'continuous' }],
  dataRetainedMode: 'clear',
});
if (res.code === 200) {
  // res.data 包含本次连拍的所有照片
  const photos = res.data;
}
```

---

## JPEG 质量控制

`quality` 字段控制 JPEG 压缩率，范围 `0~1`，**默认 `0.9`**。值越低，文件越小，质量越差。

```tsx
await api.open({
  cameraMode: [
    { mode: 'single', quality: 0.75 },   // 更小的文件体积
  ],
  dataRetainedMode: 'clear',
});
```

:::tip 何时调低 quality
上传前端接口有文件大小限制时，可将 `quality` 设为 `0.6`~`0.8` 以降低传输体积。对画质要求极高的场景（如证件留档），保持默认 `0.9` 或设为 `1`。
:::

---

## 多模式 tab

`cameraMode` 传入多项时，相机底部会自动出现**模式 tab**，供用户在拍摄过程中自由切换。

```tsx
await api.open({
  cameraMode: [
    { mode: 'single', quality: 0.9 },
    { mode: 'continuous' },
  ],
  dataRetainedMode: 'clear',
});
```

此时底部出现「单拍 / 连拍」两个 tab，用户可随时切换。

---

## `dataRetainedMode`：切换模式时是否保留照片

多模式场景下，用户从「单拍」切到「连拍」时，已拍的照片是否保留由 `dataRetainedMode` 控制：

| 值 | 行为 |
| --- | --- |
| `'clear'` | 切换模式时**清除**已拍照片（推荐用于大多数场景） |
| `'retain'` | 切换模式时**保留**已拍照片，合并进最终结果 |

```tsx
// 切模式时保留已拍照片，最终 res.data 包含两个模式的所有照片
await api.open({
  cameraMode: [
    { mode: 'single' },
    { mode: 'continuous' },
  ],
  dataRetainedMode: 'retain',
});
```

---

## 平台差异 / 注意事项

:::tip 真机验证
相机功能依赖原生摄像头，**无法在模拟器中预览实际效果**，请在真机上完成最终验证。
:::

:::tip 权限配置
首次调用 `api.open()` 前，请确认 `Info.plist`（iOS）与 `AndroidManifest.xml`（Android）已添加相机权限声明。详见 [安装 → 权限配置](/docs/getting-started/installation#权限配置)。
:::

---

## 相关

- [API 参考 → 类型定义](/docs/api/types) — `OpenConfig` / `CameraMode` / `CameraResult` / `CustomPhotoFile` 完整字段表
- [API 参考 → useCamera](/docs/api/use-camera) — `useCamera` hook 完整文档
- [指南 → 录像](/docs/guides/recording-video) — 视频录制配置
- [指南 → 水印](/docs/guides/watermark) — 给照片烧入文字水印
