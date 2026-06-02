# @unif/react-native-camera

[![npm](https://img.shields.io/npm/v/@unif/react-native-camera.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/@unif/react-native-camera)
[![CI](https://github.com/unif-design/react-native-camera/actions/workflows/ci.yml/badge.svg)](https://github.com/unif-design/react-native-camera/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@unif/react-native-camera.svg?color=blue)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-unif--design.github.io-orange.svg)](https://unif-design.github.io/react-native-camera/)

基于 [react-native-vision-camera](https://github.com/mrousavy/react-native-vision-camera) 5.x 的 React Native 模态相机库：单拍 / 连拍 / 视频录制 / 捏合变焦 / 镜头切换 / 点击对焦 / 水印。

> 📖 **完整文档**（安装 · 原生配置 · API · 水印 · 故障排查 · 升级）：
> **https://unif-design.github.io/react-native-camera/**

## 安装

```sh
yarn add @unif/react-native-camera \
  react-native-vision-camera react-native-vision-camera-worklets \
  react-native-nitro-modules react-native-nitro-image \
  react-native-reanimated react-native-worklets react-native-reanimated-carousel \
  react-native-video @shopify/react-native-skia @dr.pogodin/react-native-fs \
  react-native-gesture-handler react-native-safe-area-context
```

iOS 再 `cd ios && pod install`。权限配置、各 peer 作用、为何 `react-native-vision-camera-worklets` 必装 —— 见[文档站 · 安装](https://unif-design.github.io/react-native-camera/docs/getting-started/installation)。

## 用法

```tsx
import { useCamera } from '@unif/react-native-camera';

const [api, holder] = useCamera();      // holder 渲进 React 树
const res = await api.open({
  cameraMode: [{ mode: 'single', quality: 0.9 }, { mode: 'continuous' }],
  dataRetainedMode: 'clear',
});
// res.code: 200 成功 / 0 取消 / 403 无权限 / 404 无设备 / 500 拍照失败 / 503 录像失败
```

API · 类型 · 水印 · 测试 mock · 从 v1 升级 —— 见[文档站](https://unif-design.github.io/react-native-camera/)。

## 许可

MIT
