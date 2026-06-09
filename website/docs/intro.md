---
sidebar_position: 1
title: 介绍
description: "@unif/react-native-camera 是基于 react-native-vision-camera 5.x 的弹窗式相机库：await api.open() 弹出全屏相机，支持单拍 / 连拍 / 录像 / Skia 水印，公开面仅 useCamera()。"
---

# @unif/react-native-camera

基于 [react-native-vision-camera](https://github.com/mrousavy/react-native-vision-camera) 5.x 的**弹窗式相机**库:一行 `await api.open()` 弹出全屏相机,用户拍完(或取消)后 Promise resolve 出结果。

[![npm](https://img.shields.io/npm/v/@unif/react-native-camera.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/@unif/react-native-camera)
[![CI](https://github.com/unif-design/react-native-camera/actions/workflows/ci.yml/badge.svg)](https://github.com/unif-design/react-native-camera/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@unif/react-native-camera.svg?color=blue)](https://github.com/unif-design/react-native-camera/blob/main/LICENSE)
[![Docs](https://img.shields.io/badge/docs-unif--design.github.io-orange.svg)](https://unif-design.github.io/react-native-camera/)

## 这个库是什么

它在 vision-camera 之上封装了一套**模态化的拍摄界面**:取景、拍照、连拍、录像、双指 pinch 变焦(含 0.5x 超广角、0.5/1 档位快捷跳档)、点击对焦、前后摄翻转、拍后预览确认、给照片烧水印——这些都做好了,你只需要调一个方法把它弹出来。

公开面只有一个 Hook —— `useCamera()`。你**不直接接触** vision-camera 的 `<Camera>` 组件、不管理相机的布局层叠、不写 Frame Processor。

## 解决什么问题

直接用 vision-camera,你要自己写取景器布局、拍照/录像逻辑、变焦/对焦手势、预览确认页、文件落盘,还要处理权限与设备缺失。本库把这些收敛成一次**命令式调用**:

```tsx
const [api, holder] = useCamera();
const res = await api.open({ cameraMode: [{ mode: 'single' }], dataRetainedMode: 'clear' });
if (res.code === 200) { /* res.data 是拍到的文件 */ }
```

拍摄流程因此是**线性**的:`await` 挂起,拍完才继续,调用方逻辑大幅简化。

## 核心概念

- **模态相机,非内嵌取景器** —— `api.open()` 弹出全屏模态,而不是把 `<CameraView />` 嵌进页面布局。适合"按需拍照"(巡检存证、表单附件、工单照片),不适合持续取景的 AR / 扫码场景。
- **唯一公开面 `useCamera()`** —— 返回 `[api, holder]`。`api` 控制开关(`open` / `close`),`holder` 是相机模态的宿主节点,**必须渲染进 React 树**,否则 `api.open()` 静默无效。
- **配置全部传给 `api.open(config)`** —— `cameraMode[]`(单拍 / 连拍 / 录像)、`dataRetainedMode`(切模式时清/留已拍文件)、可选 `watermark`(给照片烧文字水印)。
- **结果用 `CameraResult.code` 判定** —— `200` 才是成功(取 `res.data`),`0` 是取消,`403/404/500/503` 是各类失败。

> 心智模型详解见[核心概念](/docs/getting-started/concepts)。

## 能力

- **单拍 / 连拍 / 录像** —— 由 `cameraMode[]` 编排,可在一次会话内提供多个模式 tab
- **pinch 变焦 · 点击对焦 · 前后摄翻转** —— 取景器内置手势(双指 pinch 缩放,实时显示倍数 + 0.5/1 档位药丸快捷跳档,含 0.5x 超广角档;前置摄像头无变焦)
- **拍后预览确认** —— 拍完进预览页,用户确认或重拍
- **Skia 水印** —— 拍照后用 Skia 把多行文字离屏烧入成片(**仅照片,录像无水印**)
- **公开面极简** —— 唯一入口 `useCamera()`,不暴露底层 vision-camera

## 何时使用

| 适用 | 不适用 |
| --- | --- |
| 按需拍照 / 连拍 / 录像存证(巡检、工单、表单附件) | 持续取景的实时画面(AR、滤镜直播) |
| 给照片烧地点 / 时间等文字水印 | 二维码 / 条码扫描 —— 用 `@unif/react-native-hms-scan` |
| 拍完拿文件 `uri` 上传 / 展示 | 需要自定义取景器布局、嵌入式相机视图 |

## 平台支持

| 平台 | 支持 |
| --- | --- |
| iOS（15.1+) | ✅ |
| Android（API 24+) | ✅ |
| Web / 模拟器 | ❌ |

:::warning 必须真机运行
相机依赖真实摄像头硬件,水印依赖 Skia GPU 渲染。**iOS 模拟器 / Android 模拟器 / Web 都跑不起来,这是预期行为,不是 bug。** 请始终在真机上验证完整行为;各 API 页面提供截图示意。
:::

:::info 仅支持新架构
本库依赖 Nitro Modules 与 vision-camera 5.x,**仅支持 React Native 0.85+ 新架构(Fabric + TurboModules)**。旧架构(Bridge)不受支持。
:::

## 下一步

- [安装](/docs/getting-started/installation) —— 装齐 peerDeps、配权限、跑 pod install
- [快速上手](/docs/getting-started/quick-start) —— 5 分钟跑通第一次拍照
- [核心概念](/docs/getting-started/concepts) —— 理解模态相机的心智模型
- [API 参考 → useCamera](/docs/api/use-camera) —— 完整 API 文档
