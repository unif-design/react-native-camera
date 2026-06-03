---
sidebar_position: 1
title: 拍照
description: "拍照场景完整指南：单拍、连拍、JPEG quality 质量控制、多模式 tab 切换与 dataRetainedMode 保留策略，附 holder / code 200 易错点。"
---

# 拍照并保存

本页介绍如何配置 `@unif/react-native-camera` 完成拍照任务——单张拍摄、连续抓拍、JPEG 质量控制，以及同时提供多种拍摄模式时的 tab 切换与照片保留策略。

---

## 基本用法：单拍 {#single}

最简场景：单拍模式，用户拍一张、确认后返回。

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

- `cameraMode: [{ mode: 'single' }]` — 只含一个 `single` 模式，底部不出现 tab。在 `dataRetainedMode: 'clear'` 下，用户按快门拍一张后**直接进入确认预览页**，点「确认」后 `open()` resolve。
- `res.code === 200` — 用户完成确认才是成功；`0` 是取消，其余错误码见 [类型 → CameraResult](/docs/api/types#cameraresult)。
- `{holder}` — 相机模态的宿主节点，**必须渲染**（见下方易错点）。

---

## 连拍 {#burst}

将 `mode` 改为 `'continuous'`，用户可连续按快门拍多张，相机持续显示缩略图条，最终一次性确认所有照片。

```tsx
const res = await api.open({
  cameraMode: [{ mode: 'continuous' }],
  dataRetainedMode: 'clear',
});
if (res.code === 200) {
  const photos = res.data; // 本次连拍的所有照片
}
```

> 连拍模式不会每拍一张就进预览；用户点击缩略图可进入相册式预览查看 / 删除，确认后整批返回。

---

## JPEG 质量控制 {#quality}

`quality` 控制 JPEG 压缩率，范围 `0~1`，**默认 `0.9`**。值越低文件越小、画质越差。

```tsx
await api.open({
  cameraMode: [
    { mode: 'single', quality: 0.75 }, // 更小的文件体积
  ],
  dataRetainedMode: 'clear',
});
```

:::tip 何时调低 quality
上传接口有大小限制时，可将 `quality` 设为 `0.6`~`0.8` 降低体积。对画质要求高的场景（如证件留档），保持默认 `0.9` 或设为 `1`。
:::

---

## 多模式 tab 与保留策略 {#multi-mode}

`cameraMode` 传入多项时，相机底部自动出现**模式 tab**（按数组顺序），供用户在拍摄过程中切换。此时 `dataRetainedMode` 决定切换模式时已拍照片的去留：

```tsx
await api.open({
  cameraMode: [
    { mode: 'single', quality: 0.9 },
    { mode: 'continuous' },
  ],
  dataRetainedMode: 'retain', // 切模式时保留已拍照片
});
```

| `dataRetainedMode` | 切换模式时的行为 |
| --- | --- |
| `'clear'` | 先弹二次确认，确认后**清空**已拍照片（推荐用于大多数场景） |
| `'retain'` | **保留**已拍照片，合并进最终 `res.data` |

> 注意：在单拍模式下 `'clear'` 还有一层语义——每拍一张后直接进入确认预览（见 [基本用法](#single)）。

---

## 易错点（Incorrect / Correct）{#pitfalls}

### 1. 不渲染 `holder` → 相机不弹

```tsx
// ❌ Incorrect：拿了 holder 却没放进 React 树
const [api, holder] = useCamera();
return <Button title="拍照" onPress={() => api.open(cfg)} />; // api.open() 静默无效
```

```tsx
// ✅ Correct：holder 必须在树里（位置不限）
const [api, holder] = useCamera();
return (
  <View>
    <Button title="拍照" onPress={() => api.open(cfg)} />
    {holder}
  </View>
);
```

### 2. 把 `0` 当成功（只有 `200` 才是成功）

```ts
// ❌ Incorrect：0 是取消，取消时 data 为空
const res = await api.open(cfg);
if (res.code === 0) use(res.data);
```

```ts
// ✅ Correct：200 才是成功
const res = await api.open(cfg);
if (res.code === 200) use(res.data);
else if (res.code === 0) { /* 用户取消，静默 */ }
else { /* 403 / 404 / 500 兜底处理 */ }
```

---

## 平台差异 / 注意事项 {#notes}

:::tip 真机验证
相机功能依赖原生摄像头，**无法在模拟器中预览实际效果**，请在真机上完成最终验证。
:::

:::tip 权限配置
首次调用 `api.open()` 前，确认 `Info.plist`（iOS）与 `AndroidManifest.xml`（Android）已声明相机权限。详见 [安装 → 配置权限](/docs/getting-started/installation#权限配置)。
:::

---

## 相关 {#related}

- [类型](/docs/api/types) — `OpenConfig` / `CameraMode` / `CameraResult` / `CustomPhotoFile` 完整字段表
- [useCamera](/docs/api/use-camera) — `useCamera` hook 完整文档
- [录像](/docs/guides/recording-video) — 视频录制配置
- [水印](/docs/guides/watermark) — 给照片烧入文字水印
