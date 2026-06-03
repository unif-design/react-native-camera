---
sidebar_position: 2
title: 录像
description: "录像场景指南：mode 'video' 视频录制、读取 duration/mime、与拍照混合的多模式 tab、503 录像失败处理及播放方案。"
---

# 录像

本页介绍如何用 `@unif/react-native-camera` 录制视频——配置 `video` 模式、读取录制结果、与拍照混合使用，以及如何在业务页面播放视频。

---

## 基本用法 {#basic}

将 `mode` 设为 `'video'` 启用视频录制：

```tsx
import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useCamera } from '@unif/react-native-camera';

const VideoScreen = () => {
  const [api, holder] = useCamera();

  const handleRecord = async () => {
    const res = await api.open({
      cameraMode: [{ mode: 'video' }],
      dataRetainedMode: 'clear',
    });
    if (res.code === 200) {
      const video = res.data[0];
      // video.mime === 'video/mp4'
      // video.uri — 视频文件 URI (file://)
      // video.duration — 视频时长（秒）
    } else if (res.code === 503) {
      // 录像失败，见下方「录像失败」
    }
  };

  return (
    <View>
      <TouchableOpacity onPress={handleRecord}>
        <Text>录像</Text>
      </TouchableOpacity>
      {holder}
    </View>
  );
};
```

用户在相机界面**点击快门开始录制，再次点击停止**，确认后 `open()` resolve。`res.data` 为 `CustomPhotoFile[]`，视频条目的 `mime` 为 `'video/mp4'`，`uri` 为本地文件路径，`duration` 为实际录制时长（秒）。

---

## 录像失败（code 503）{#failure}

若录制过程中停止视频时**没有产出有效文件**（底层 `stopVideo` 返回空），`open()` resolve 出 `code: 503`：

```ts
const res = await api.open({
  cameraMode: [{ mode: 'video' }],
  dataRetainedMode: 'clear',
});
if (res.code === 503) {
  // 录像失败：data 为空，提示用户重试
}
```

> `503` 专指录像失败；拍照失败是 `500`。完整状态码见 [类型 → CameraResult](/docs/api/types#cameraresult)。

---

## 录制时长上限（recTime）{#rectime}

`CameraMode` 类型上保留了 `recTime`（秒）字段，但当前版本**源码未对它接线（no-op）**——传入不会限制时长，也不会自动停止录制。

```tsx
await api.open({
  // recTime 当前不生效，录制需用户手动停止
  cameraMode: [{ mode: 'video', recTime: 60 }],
  dataRetainedMode: 'clear',
});
```

:::warning recTime 当前为 no-op
`recTime` 是从原版沿用的类型保留字段，目前不会限制录制时长。**需要时长上限请在业务侧自行处理**（例如拿到结果后按 `duration` 校验，或用计时器在 UI 层提示）。详见 [类型 → CameraMode](/docs/api/types#cameramode)。
:::

---

## 与拍照混合使用 {#mixed}

`cameraMode` 可同时包含 `video` 与照片模式，相机底部出现模式 tab：

```tsx
await api.open({
  cameraMode: [
    { mode: 'single', quality: 0.9 },
    { mode: 'video' },
  ],
  dataRetainedMode: 'clear',
});
```

用户自行切换「拍照 / 录像」，最终 `res.data` 混合包含两种类型的文件，通过 `mime` 字段区分（`'image/jpeg'` vs `'video/mp4'`）。

---

## 播放录制结果 {#playback}

相机库本身不提供播放器。预览录制视频，推荐使用 `react-native-video` **7.x**（`useVideoPlayer` + `VideoView` API）：

```tsx
import { VideoView, useVideoPlayer } from 'react-native-video';

// videoUri 来自 res.data[0].uri
const player = useVideoPlayer(videoUri, p => {
  p.loop = false;
});

return <VideoView player={player} style={{ width: '100%', aspectRatio: 9 / 16 }} />;
```

:::tip react-native-video 版本
使用 **7.x**（`useVideoPlayer` + `VideoView`）。旧版 6.x 的 `<Video source={...} />` API 已废弃。
:::

---

## 平台差异 / 注意事项 {#notes}

:::warning 视频不烧水印
`watermark` 配置**仅对照片生效**，视频录制结果不会烧入水印。若需在视频帧上叠加信息，需另行实现。
:::

:::tip 麦克风权限
录像需要麦克风权限。iOS `Info.plist` 须有 `NSMicrophoneUsageDescription`，Android `AndroidManifest.xml` 须有 `RECORD_AUDIO` 权限。详见 [安装 → 配置权限](/docs/getting-started/installation#权限配置)。
:::

:::tip 真机验证
视频录制依赖原生摄像头，无法在模拟器中完整验证，请在真机上测试。
:::

---

## 相关 {#related}

- [类型](/docs/api/types) — `CameraMode`（`recTime`）/ `CustomPhotoFile`（`duration` / `mime`）字段表
- [useCamera](/docs/api/use-camera) — `useCamera` hook 完整文档
- [拍照](/docs/guides/taking-photos) — 单拍 / 连拍配置
- [水印](/docs/guides/watermark) — 给照片烧入文字水印
