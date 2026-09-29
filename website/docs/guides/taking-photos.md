---
sidebar_position: 1
title: 拍照
description: '单拍、连拍、图片质量和拍摄结果处理。'
---

# 拍照

使用 `single` 单拍或 `continuous` 连拍。相机权限在打开时处理，只有实际开始录像才申请麦克风权限。

## 单拍

```ts
const result = await camera.open({
  modes: [{ mode: 'single', quality: 0.9 }],
  initialFacing: 'back',
  initialFlash: 'auto',
  retention: 'clear',
});
if (result.status === 'success') {
  const photos = result.media;
  // photos 中每项都有 uri、实际 facing、mimeType 和最终尺寸。
}
```

单拍 `clear` 拍完进入确认预览，用户选用后才返回成功。

## 连拍与混合模式

```ts
const result = await camera.open({
  modes: [{ mode: 'continuous', quality: 0.9 }, { mode: 'single' }],
  retention: 'retain',
});
```

模式按数组顺序显示，首项为初始模式。`retain` 在切换时保留媒体；`clear` 在已有媒体时先取得丢弃确认，拒绝时保持模式与媒体。最终 `result.media` 仅在 `success` 分支可读。

## 照片质量

```ts
const result = await camera.open({
  modes: [
    { mode: 'single', quality: 0.85, qualityPriority: 'quality', hdr: true },
  ],
  retention: 'clear',
});
```

`quality` 必须是有限的 `0..1` 数值，显式值会用于真实编码。未设置且需要编码时使用 `0.9`；已经满足输出要求的文件可以直接交付。`qualityPriority` 和 `hdr` 缺省时使用 SDK 默认，显式值按实际能力处理。设备不支持 `speed` 或照片 HDR 时，对应的显式请求会在拍照时提示配置错误并保留本轮媒体；调用方可改用设备支持的参数后重新打开。

拍照或文件处理失败时，相机会保留此前媒体并显示错误，允许再次操作。不会把本次失败的原图当成已处理结果返回。完整结果见[公共类型](/docs/api/types)。
