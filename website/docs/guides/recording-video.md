---
sidebar_position: 2
title: 录像
description: '录像配置、时长控制和错误处理。'
---

# 录制视频

`video` 模式支持录制、停止、预览与选用。相机权限在打开时处理，麦克风权限在实际开始录像时按需申请。

```ts
const result = await camera.open({
  modes: [{ mode: 'video', maxDurationSeconds: 60 }],
  retention: 'clear',
});
if (result.status === 'success') {
  const video = result.media.find((media) => media.mimeType === 'video/mp4');
  console.log(video?.uri, video?.durationMs);
}
```

用户点快门开始，再点停止；达到 `maxDurationSeconds` 后自动停止。该参数是有限正秒数，不传时不设置自动停止上限。返回的 `durationMs` 是真实时长，单位为毫秒，只在获得真实值时提供。

## 码率

```ts
const result = await camera.open({
  modes: [{ mode: 'video', bitRate: 24_000_000 }],
  retention: 'clear',
});
```

`bitRate` 的单位是 bps，必须是有限正数。不传时使用 SDK 默认；显式设置按实际 SDK 能力处理。编码器产生的实际码率可能受设备与画面影响。

## 照片与录像共存

```ts
const result = await camera.open({
  modes: [{ mode: 'single' }, { mode: 'video', maxDurationSeconds: 15 }],
  retention: 'retain',
});
```

用 `mimeType` 区分照片与视频。水印只作用于照片。麦克风拒绝或录像局部失败时保留当前交互和此前媒体，让用户重试、换模式或取消。

取消使用本次调用的 `AbortController`；旧录像的迟到回调不会影响后续调用。成功交付的文件由消费者负责保存、上传及释放。播放器可使用项目自己的媒体播放组件。
