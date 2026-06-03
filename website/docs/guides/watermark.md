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

- **快门后逐张合成**：用 `@shopify/react-native-skia` 在全分辨率离屏 surface 上画原图 + 逐行画水印文字，编码为 JPEG，再用 `@dr.pogodin/react-native-fs` 写回临时文件；合成期间相机 footer 显示「正在生成水印图片…」。
- **串行处理**：一次只烧一张，峰值内存恒定，不受连拍张数影响（Skia 原生对象用后即释放，避免大图反复烧导致 OOM）。
- **失败不阻断保存**：解码 / 离屏分配 / 读写出现任何异常时，**返回未加水印的原图**，绝不阻断拍摄流程。
- `res.data` 返回的已是处理后的成片，消费端无需额外处理。

---

## 截图示意 {#preview}

:::warning 真机查看
以下为示意占位——水印合成依赖原生 Skia 渲染，**请在真机上查看实际效果**。模拟器可显示取景器戳记，但最终成片合成需真机验证。
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

:::danger 需安装额外依赖并 pod install
水印功能依赖以下两个同伴包（已在 `peerDependencies` 中声明），未安装时传入 `watermark` 会导致运行时错误：

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
