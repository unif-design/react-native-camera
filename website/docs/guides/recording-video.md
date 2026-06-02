---
sidebar_position: 2
title: 录像
description: 视频录制模式配置与时长限制，以及预览播放方案。
---

# 录像

本页介绍如何用 `@unif/react-native-camera` 录制视频——配置 `video` 模式、设置录制时长上限，以及如何在业务页面播放录制结果。

---

## 基本用法

将 `mode` 设为 `'video'` 启用视频录制模式：

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
      // res.data[0].mime === 'video/mp4'
      // res.data[0].uri — 视频文件 URI (file://)
      // res.data[0].duration — 视频时长(秒)
      const video = res.data[0];
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

用户在相机界面长按快门开始录制，松开或再次点击停止，确认后 `open()` resolve。`res.data` 为 `CustomPhotoFile[]`，视频条目的 `mime` 为 `'video/mp4'`，`uri` 为本地文件路径。

---

## 设置录制时长上限

通过 `recTime`（单位：**秒**）限制最长录制时长。达到上限后相机自动停止录制：

```tsx
await api.open({
  cameraMode: [
    { mode: 'video', recTime: 60 },  // 最多录制 60 秒
  ],
  dataRetainedMode: 'clear',
});
```

不传 `recTime` 则不限制时长，用户需手动停止录制。

---

## 与拍照混合使用

`cameraMode` 可同时包含 `video` 和照片模式，相机底部出现模式 tab：

```tsx
await api.open({
  cameraMode: [
    { mode: 'single', quality: 0.9 },
    { mode: 'video', recTime: 30 },
  ],
  dataRetainedMode: 'clear',
});
```

用户可自行切换「拍照 / 录像」，最终 `res.data` 混合包含两种类型的文件，通过 `mime` 字段区分。

---

## 播放录制结果

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
请使用 **7.x** 版本（`useVideoPlayer` + `VideoView` API）。旧版 6.x 的 `<Video source={...} />` API 已废弃。
:::

---

## 平台差异 / 注意事项

:::warning 视频不烧水印
`watermark` 配置**仅对照片生效**，视频录制结果不会烧入水印。若需在视频帧上叠加信息，需另行实现。
:::

:::tip 麦克风权限
录像需要麦克风权限。iOS `Info.plist` 须有 `NSMicrophoneUsageDescription`，Android `AndroidManifest.xml` 须有 `RECORD_AUDIO` 权限。详见 [安装 → 权限配置](/docs/getting-started/installation#权限配置)。
:::

:::tip 真机验证
视频录制依赖原生摄像头，无法在模拟器中完整验证，请在真机上测试。
:::

---

## 相关

- [API 参考 → 类型定义](/docs/api/types) — `OpenConfig` / `CameraMode`（`recTime` 字段）/ `CustomPhotoFile`（`duration` / `mime` 字段）完整表格
- [API 参考 → useCamera](/docs/api/use-camera) — `useCamera` hook 完整文档
- [指南 → 拍照](/docs/guides/taking-photos) — 单拍 / 连拍配置
- [指南 → 水印](/docs/guides/watermark) — 给照片烧入文字水印
