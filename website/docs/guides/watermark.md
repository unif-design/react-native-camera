---
sidebar_position: 3
title: 水印
description: "给照片烧入文字水印：watermark.content[] 多行文字、position 六向定位、仅 JPEG 照片生效（录像无水印），并说明水印是可视标注、非防篡改。"
---

# 给照片加水印

本页介绍如何通过 `watermark` 配置在拍照时给成片烧入文字水印——适用于巡检记录、现场留证等需要在照片上附加可见信息的场景。

---

## 基本用法 {#basic}

在 `api.open()` 的配置中传入 `watermark` 字段：

```tsx
import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useCamera } from '@unif/react-native-camera';

const InspectionScreen = () => {
  const [api, holder] = useCamera();

  const handleCapture = async () => {
    const res = await api.open({
      cameraMode: [{ mode: 'single', quality: 0.9 }],
      dataRetainedMode: 'clear',
      watermark: {
        content: ['Unif · 巡检记录', '上海市浦东新区…', '2024-01-01 10:00'],
        position: 'top-right',
      },
    });
    if (res.code === 200) {
      // res.data[0].uri — 已烧入水印的照片
    }
  };

  return (
    <View>
      <TouchableOpacity onPress={handleCapture}>
        <Text>拍照（带水印）</Text>
      </TouchableOpacity>
      {holder}
    </View>
  );
};
```

**逐行讲解：**

- `watermark.content` — 字符串数组，**每个字符串是独立一行**，数量不限。
- `watermark.position` — 水印显示位置，**缺省 `'top-right'`**（见下方位置说明）。
- 取景器实时显示同款水印戳记（WYSIWYG），保存时把水印烧进成片；`res.data` 返回的即已烧好水印的照片。

---

## 水印位置 {#position}

`position` 支持六个值，文字对齐方向随位置自适应（右侧位置文字向左扩展，居中位置向两侧扩展，左侧向右扩展）：

| 值 | 位置 |
| --- | --- |
| `'top-left'` | 左上角 |
| `'top-center'` | 顶部居中 |
| `'top-right'` | 右上角（**默认**） |
| `'bottom-left'` | 左下角 |
| `'bottom-center'` | 底部居中 |
| `'bottom-right'` | 右下角 |

```tsx
// 左下角水印（适合横向构图）
watermark: {
  content: ['现场勘查', '经手人：张三'],
  position: 'bottom-left',
},
```

---

## 内部工作原理 {#internals}

- **捕获端先限制**：VisionCamera 按最终画幅请求 FHD（4:3 为 1440×1920，16:9 为 1080×1920），并通过 `capturePhotoToFile()` 直接落临时 JPEG；不会先拿 12MP in-memory Photo 再缩。
- **文件级逐张合成**：iOS 在需要时先用 ImageIO thumbnail 下采样，再用复用的 Core Image context 延迟串联 EXIF 方向、居中裁切、缩放与 CoreText 水印并直接写 JPEG；Android 用 BitmapFactory `inSampleSize` 采样解码，在一个目标 Bitmap 上用 Canvas 完成同样操作并直接压缩到 OutputStream。全程没有 JS Base64、RNFS 图片内容中转或 Skia 全图 Surface。
- **串行处理**：一次只烧一张，不叠加并发照片事务；源图与目标缓冲都受 FHD 上界约束。真实峰值仍以旧设备 Instruments / Android Profiler 为准，不能只靠像素公式宣称恒定。
- **失败留在会话内重试**：读取 / 解码 / 目标缓冲分配 / 裁切 / 水印 / 编码 / 写入任一异常时，不交付未加水印的 raw 或半成品；相机回到可拍状态，保留此前文件并提示“照片处理失败，请重试”。录像不经过照片 processor。
- `res.data` 返回的已是处理后的成片，消费端无需额外处理。

---

## 截图示意 {#preview}

:::warning 真机查看
以下为示意占位——水印成片依赖真实照片文件，**请在真机上查看实际效果**。模拟器可显示取景器戳记，但最终成片、相机内存峰值与文件生命周期需真机验证。
:::

```
┌─────────────────────────────┐
│  Unif · 巡检记录  ◀ 右上角  │
│  上海市浦东新区…             │
│  2024-01-01 10:00           │
│                             │
│         [取景画面]           │
│                             │
└─────────────────────────────┘
```

---

## 平台差异 / 注意事项 {#notes}

:::warning 水印是可视标注，不提供防篡改保证
水印烧入后是图片内容的一部分、肉眼可见，但它**只是可视标注**——无法阻止虚拟相机伪造、替换照片，也无法防止事后用工具篡改图片文件。

⚠️ 巡检记录、现场留证等场景**不要把水印当作真实性 / 防篡改凭据**。若业务确需可信留证，防篡改是独立课题，应在 App 与后端侧另行保障，例如：

- **拍摄即上传**：成片在 App 内直接上传后端，缩短可篡改窗口；只走 `useCamera` 实时拍摄、不接受用户从相册选图。
- **服务端校验**：上传时由后端计算并存储内容哈希 / 数字签名 + 可信时间戳，后续比对验真。
- **采集上下文**：连同设备标识、定位、时间等元数据一并上报，服务端交叉核验。

本库只负责把水印**可视化烧入照片**，不提供上述任何加密 / 防伪 / 存证能力。
:::

:::danger 需安装同伴包并 pod install
实时水印预览与 session 文件管理依赖以下两个同伴包（已在 `peerDependencies` 中声明）；成片处理器随本库原生模块一同安装：

```sh
yarn add @shopify/react-native-skia @dr.pogodin/react-native-fs
```

iOS 还需重新运行 `pod install`：

```sh
cd ios && bundle exec pod install
```
:::

:::warning 视频不烧水印
`watermark` 配置仅对**照片**（`mime === 'image/jpeg'`）生效。视频录制结果不会烧入水印。
:::

---

## 相关 {#related}

- [类型](/docs/api/types) — `WatermarkType`（`content` / `position`）/ `OpenConfig` 字段表
- [拍照](/docs/guides/taking-photos) — 单拍 / 连拍 / 多模式配置
- [录像](/docs/guides/recording-video) — 视频录制配置
