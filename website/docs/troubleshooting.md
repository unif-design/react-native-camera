---
sidebar_position: 6
title: 常见问题
description: '按使用场景排查接入、平台和结果处理问题。'
---

# 常见问题

## open 返回 unavailable

确保 `useCamera()` 返回的 `holder` 已在稳定 React 树中挂载，再执行 `open()`。缺少宿主会明确失败。宿主真实卸载取消所属调用。也应读取 `error.message`，确认原生相机是否无法维持交互。

## 权限拒绝或没有设备

`failed / permission_denied` 表示相机权限拒绝；按系统设置恢复权限后再调用。`failed / no_device` 表示没有可用相机。相机和麦克风声明见[安装](/docs/getting-started/installation#权限配置)。麦克风仅在实际开始录像时请求；其局部失败留在相机内提示。

## Web 与模拟器

Web 的真实入口隔离原生模块，返回 `failed / unsupported`。模拟器不能替代真实拍摄设备；Jest 使用[官方 mock](/docs/testing)。

## 水印未出现

确认当前模式是照片，且 `watermark.lines` 非空。录像不烧录水印。检查原生照片处理模块是否已重新编译，以及 Skia 等依赖是否完整。处理失败会在相机内提示，不返回未加水印的原图。

## 模块找不到或原生符号缺失

按[完整依赖清单](/docs/getting-started/installation#安装依赖)安装并重新构建。VisionCamera 的 worklets 包需要一起安装；文件系统使用 `@dr.pogodin/react-native-fs`。iOS 原生依赖变化后执行 `pod install`，重新编译 App。

## 处理结果

```ts
switch (result.status) {
  case 'success':
    console.log(result.media);
    break;
  case 'cancelled':
    break;
  case 'failed':
    console.error(result.error.reason, result.error.message);
    break;
}
```

取消不会作为成功返回，失败也没有媒体集合。`invalid_input` 不会关闭当前有效交互。取消某次调用应使用它自己的 `AbortController`。

## 成功后文件是否永久保存

文件仍在临时目录。成功交付后由消费者负责保存或上传以及后续释放，不能把拍摄成功当作上传完成。库仅清理仍属于本轮的未交付文件。

## 录像时长与码率

输入 `maxDurationSeconds` 单位为秒，输出 `durationMs` 单位为毫秒；没有真实时长时字段缺省。`bitRate` 放在 video 模式项中。显式能力按 SDK 真实支持处理，局部录制错误会在相机内显示。
