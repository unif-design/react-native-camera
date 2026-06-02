---
sidebar_position: 1
title: 介绍
description: "@unif/react-native-camera — 基于 vision-camera 5.x 的 React Native 模态相机库，支持单拍 / 连拍 / 视频录制 / 水印等能力。"
---

# @unif/react-native-camera

[![npm](https://img.shields.io/npm/v/@unif/react-native-camera.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/@unif/react-native-camera)
[![CI](https://github.com/unif-design/react-native-camera/actions/workflows/ci.yml/badge.svg)](https://github.com/unif-design/react-native-camera/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@unif/react-native-camera.svg?color=blue)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-unif--design.github.io-orange.svg)](https://unif-design.github.io/react-native-camera/)

基于 [react-native-vision-camera](https://github.com/mrousavy/react-native-vision-camera) 5.x 构建的 React Native 模态相机库，提供开箱即用的模态化相机界面。

## 能力

- **单拍** — 一次拍摄单张照片
- **连拍** — 连续拍摄多张照片
- **视频录制** — 录制视频并预览
- **捏合变焦** — 手势缩放调整焦距
- **镜头切换** — 前置 / 后置摄像头切换
- **点击对焦** — 点击取景器指定对焦区域
- **水印** — 拍摄后将文字水印烧入成片（基于 Skia 离屏合成）

## 平台支持

| 平台    | 支持 |
| ------- | ---- |
| iOS     | ✅   |
| Android | ✅   |
| Web     | ❌   |

:::warning 真机运行
相机功能依赖原生摄像头，**无法在浏览器或模拟器中预览实际效果**。各 API 页面提供截图示意，请在真机上验证完整行为。
:::

## 下一步

- [快速开始 → 安装](/docs/getting-started/installation)
- [API 参考 → useCamera](/docs/api/use-camera)
