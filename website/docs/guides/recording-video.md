---
sidebar_position: 2
title: 录像
description: "录像场景指南：mode 'video' 视频录制、读取 duration/mime、与拍照混合的多模式 tab、recTime 时长上限、录像失败的相机内重试及播放方案。"
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
    }
    // 录像失败不再返回 code：相机内顶部错误条提示重试、不关相机（见下方「录像失败」）
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

## 录像失败（不关相机，相机内重试）{#failure}

录像启动失败、或停止时**没有产出有效文件**（底层 `stopVideo` 返回空）时，相机**不关闭、也不 resolve**——而是在相机内弹出**顶部错误条**提示重试，已拍内容不丢。消费者侧无需为此写 `code` 分支：

```ts
const res = await api.open({
  cameraMode: [{ mode: 'video' }],
  dataRetainedMode: 'clear',
});
// 录像失败不再 resolve 出 503：用户在相机内看到错误条、可重录；
// 真正 resolve 时要么 200（成功有文件）、要么 0（用户取消）。
```

> 旧版（≤2.20）录像失败会 resolve 出 `code: 503` 关闭相机；自 2.21 起改为相机内重试（对齐 1.x「失败停留」），`503` 保留作 API 兼容但当前无触发路径。完整状态码见 [类型 → CameraResult](/docs/api/types#cameraresult)。

---

## 录制时长上限（recTime）{#rectime}

`CameraMode.recTime`（秒）已接线到 vision-camera 的 `maxDuration`：录制到达该时长时**原生侧自动停止**，录好的视频**自动进入已拍列表**（与用户手动停止一致）。缺省不传则不自动停，由用户手动结束。

```tsx
await api.open({
  // 录到 60 秒自动停止，视频自动入列；用户也可在 60 秒前手动停止
  cameraMode: [{ mode: 'video', recTime: 60 }],
  dataRetainedMode: 'clear',
});
```

:::tip recTime 已接线（2.21 起）
到点自动停止后，视频与手动停止产出的文件走同一路径（进预览 / 累积、`duration` 为实际时长）。无需在业务侧另写计时器。详见 [类型 → CameraMode](/docs/api/types#cameramode)。
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
