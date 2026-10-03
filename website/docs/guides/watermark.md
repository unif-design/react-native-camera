---
sidebar_position: 3
title: 水印
description: '配置照片文字水印的位置与内容。'
---

# 照片水印

用 `watermark.lines` 提供逐行文字，取景时预览，保存时写入照片像素。地点、业务标题与时间由调用方准备，相机不请求定位或推断业务内容。

```ts
const result = await camera.open({
  modes: [{ mode: 'single', quality: 0.9 }],
  retention: 'clear',
  watermark: {
    lines: ['巡检记录', '地点：上海', new Date().toISOString()],
    position: 'bottom-right',
  },
});
if (result.status === 'success') {
  console.log(result.media[0]?.uri);
}
```

## 位置与空内容

`position` 支持 `top-left`、`top-center`、`top-right`、`bottom-left`、`bottom-center`、`bottom-right`，默认 `top-right`。`lines: []` 不生成水印。

## 输出与失败

水印仅用于照片，录像不会烧录文字。iOS 文件处理使用 ImageIO / Core Image，Android 使用 BitmapFactory / Canvas。原生文件处理负责方向、裁切、尺寸和水印，返回的媒体尺寸对应实际输出。成片水印按图像参数计算，不随宿主界面字号变化。

处理失败时留在相机内显示错误，保留此前媒体，不交付未加水印的原图。水印是可见像素，不能作为防篡改证明；成功文件仍是临时文件，需要调用方保存或上传。
