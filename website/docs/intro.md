---
sidebar_position: 1
title: 介绍
description: 'React Native 相机库：单拍、连拍、录像、预览确认和照片水印。'
---

# Camera 相机

基于 Vision Camera 的 React Native 相机库，提供单拍、连拍、录像、预览确认和照片水印。由 Unif 维护，可在满足依赖要求的 React Native 项目中使用。

## 何时使用

适合表单附件、现场记录等按需拍摄场景。应用通过 `useCamera()` 打开全屏相机并接收临时文件；保存、上传和业务提交由应用处理。

## 开始使用

1. 按[安装指南](/docs/getting-started/installation)配置依赖和权限。
2. 按[快速上手](/docs/getting-started/quick-start)挂载 `holder` 并调用 `open()`。
3. 通过 `code === 200` 处理成功结果；`0` 表示取消。

## 功能与文档

| 功能         | 文档                                     |
| ------------ | ---------------------------------------- |
| 单拍与连拍   | [拍照](/docs/guides/taking-photos)       |
| 录像         | [录制视频](/docs/guides/recording-video) |
| 照片文字水印 | [水印](/docs/guides/watermark)           |
| 调用与结果   | [CameraApi](/docs/api/camera-api)        |
| 参数类型     | [类型参考](/docs/api/types)              |

## 平台说明

需要 React Native 新架构。完整拍摄链路在 iOS／Android 真机验证；Web 不提供摄像头能力，模拟器和 mock 不替代真机行为验收。具体系统与依赖要求见安装指南。

[调用与资源说明](/docs/getting-started/concepts) · [测试](/docs/testing) · [常见问题](/docs/troubleshooting)
