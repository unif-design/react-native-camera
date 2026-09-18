---
sidebar_position: 3
title: 水印
description: '配置照片文字水印的位置与内容。'
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

| 值                | 位置               |
| ----------------- | ------------------ |
| `'top-left'`      | 左上角             |
| `'top-center'`    | 顶部居中           |
| `'top-right'`     | 右上角（**默认**） |
| `'bottom-left'`   | 左下角             |
| `'bottom-center'` | 底部居中           |
| `'bottom-right'`  | 右下角             |

```tsx
// 左下角水印（适合横向构图）
watermark: {
  content: ['现场勘查', '经手人：张三'],
  position: 'bottom-left',
},
```

---

## FAQ {#notes}

### 照片水印由哪里处理？ {#internals}

Skia 用于取景预览，成片由本库原生文件处理器写入：iOS 使用 ImageIO / Core Image，Android 使用 BitmapFactory / Canvas。照片串行处理，应用不需要在 JavaScript 中重复烧录水印；真实内存峰值仍需按设备和使用场景验证。

### 为什么录像没有水印？

水印只作用于照片。录像不会进入照片处理器；配置水印不表示视频会自动叠加文字。

### 处理失败会返回原图吗？

不会。相机保留当前会话和此前已拍文件，提示“照片处理失败，请重试”，等待用户重试或取消；未完成的原图或中间文件不作为成功结果交付。

### 水印能证明照片未被篡改吗？

不能。水印是写入像素的可见文字，本库不提供真实性证明或防篡改能力。应用的存证与业务规则在各自流程中处理。

### 如何查看实际效果？ {#preview}

在真机拍摄后检查返回文件。取景预览和示意图不能证明最终文件、设备内存或文件生命周期已经通过验证。

### 需要额外配置依赖吗？

按[安装指南](/docs/getting-started/installation)准备 Skia、文件系统和原生模块。原生依赖变化后重新安装 Pods 并构建对应平台；不要只检查 JavaScript 预览。

## 相关 {#related}

- [相机配置](/docs/api/camera-api#watermark-behavior)
- [WatermarkType](/docs/api/types#watermarktype)
- [调用与资源](/docs/getting-started/concepts)
