---
sidebar_position: 3
title: 水印
description: 用 Skia 离屏合成把文字水印烧进照片——配置、位置与注意事项。
---

# 给照片加水印

本页介绍如何通过 `watermark` 配置项在拍照时给成片烧入文字水印——适用于巡检记录、现场留证等需要在照片上附加可见信息的场景。

---

## 基本用法

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
      // res.data[0].uri — 已烧入水印的照片路径
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

- `watermark.content` — 水印文字数组，每个字符串是独立一行，数量不限。
- `watermark.position` — 水印显示位置，**缺省 `'top-right'`**（见下方位置说明）。
- 取景器会实时显示同款水印戳记（WYSIWYG），预览页展示已烧入的成片。

---

## 水印位置

`position` 支持六个值：

| 值 | 位置 |
| --- | --- |
| `'top-left'` | 左上角 |
| `'top-center'` | 顶部居中 |
| `'top-right'` | 右上角（**默认**） |
| `'bottom-left'` | 左下角 |
| `'bottom-center'` | 底部居中 |
| `'bottom-right'` | 右下角 |

文字对齐方向随位置自适应：右侧位置文字向左扩展，居中位置向两侧扩展。

```tsx
// 示例：左下角水印（适合横向构图）
watermark: {
  content: ['现场勘查', '经手人：张三'],
  position: 'bottom-left',
},
```

---

## 内部工作原理

- **快门后逐张**用 `@shopify/react-native-skia` 全分辨率离屏合成，再用 `@dr.pogodin/react-native-fs` 写回文件；合成期间相机 footer 显示「正在生成水印图片…」。
- **串行处理**：一次只烧一张，峰值内存恒定，不受连拍张数影响。
- `res.data` 返回的已是烧好水印的成片，消费端无需额外处理。

---

## 截图示意

:::warning 真机查看
以下区域为示意占位——水印合成效果依赖原生 Skia 渲染，**请在真机上查看实际效果**。模拟器可显示取景器戳记，但最终成片合成需真机验证。
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

## 平台差异 / 注意事项

:::warning 水印是可视记录，不防篡改
水印烧入后作为图片内容的一部分可见，但**无法阻止虚拟相机替换照片或事后篡改图片文件**。防篡改（数字签名、区块链存证等）属于独立课题，本库不提供。
:::

:::danger 需安装额外依赖并 pod install
使用水印功能前，必须安装以下两个同伴包：

```sh
yarn add @shopify/react-native-skia @dr.pogodin/react-native-fs
```

iOS 还需重新运行 `pod install`：

```sh
cd ios && bundle exec pod install
```

未安装这两个包时，传入 `watermark` 配置将导致运行时错误。
:::

:::warning 视频不烧水印
`watermark` 配置仅对**照片**生效。视频录制结果不会烧入水印。
:::

---

## 相关

- [API 参考 → 类型定义](/docs/api/types) — `OpenConfig`（`watermark` 字段）/ `WatermarkType` 完整定义
- [指南 → 拍照](/docs/guides/taking-photos) — 单拍 / 连拍 / 多模式配置
- [指南 → 录像](/docs/guides/recording-video) — 视频录制配置
