---
sidebar_position: 6
title: 常见问题
description: "@unif/react-native-camera 在 iOS / Android / Frame Processor / 水印等场景下的已知问题与修复方法。"
---

# 常见问题

## iOS

### ❓ pod install 报 LICENSE 警告

```
[!] The `...` pod ...  has a license... which doesn't provide any official binaries...
```

✅ **无害，可忽略。** 这是 CocoaPods 对部分私有/非标准 LICENSE 的提示，不影响编译和运行。

---

### ❓ 相机打开后画面全黑

✅ **缺少权限声明。** 检查 `ios/<App>/Info.plist` 是否包含以下三个 key：

```xml
<key>NSCameraUsageDescription</key>
<string>需要访问相机以拍摄照片</string>
<key>NSMicrophoneUsageDescription</key>
<string>需要访问麦克风以录制视频</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>需要访问相册以保存照片</string>
```

详见[安装 → 权限配置](./getting-started/installation#权限配置)。

---

## Android

### ❓ 相机功能无响应 / 权限始终被拒

✅ **缺少权限声明。** 检查 `android/app/src/main/AndroidManifest.xml` 是否包含：

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```

详见[安装 → 权限配置](./getting-started/installation#权限配置)。

---

## Frame Processor / Worklets

:::danger 必装同伴包
`react-native-vision-camera-worklets` 是必装同伴包，**即使本库不使用 Frame Processor**，Metro 在静态分析阶段仍会解析 vision-camera 内部对该包的懒 `require`，缺失会直接报错。
:::

### ❓ 打包报错 `Unable to resolve module react-native-vision-camera-worklets`

✅ 安装缺失的同伴包：

```sh
yarn add react-native-vision-camera-worklets
cd ios && bundle exec pod install
```

版本须与 `react-native-vision-camera` 对齐（同为 `^5.x`）。详见[安装](./getting-started/installation)。

---

### ❓ 运行时报错 `Cannot use Frame Processors - react-native-vision-camera-worklets is not installed`

✅ 同上——安装 `react-native-vision-camera-worklets` 并重新编译（iOS 需 `pod install`）。

---

## 水印

### ❓ 水印不渲染 / 应用崩溃

✅ **缺少水印依赖。** 水印功能依赖 `@shopify/react-native-skia` 和 `@dr.pogodin/react-native-fs`，二者缺一都会导致水印静默失效或崩溃。安装后 iOS 必须重新 `pod install`：

```sh
yarn add @shopify/react-native-skia @dr.pogodin/react-native-fs
cd ios && bundle exec pod install
```

详见[指南 → 水印](./guides/watermark)。

---

## 真机限制

### ❓ 相机 / 水印在模拟器或浏览器中无法使用

✅ **这是预期行为，不是 bug。** react-native-vision-camera 依赖真实相机硬件，模拟器不提供相机访问；水印合成同样依赖 Skia GPU 渲染，在模拟器上可能异常。**请始终在真机上测试相机和水印功能。**

:::tip 测试建议
单元测试请使用[测试(Mock)](./testing)页的 `jest.mock` 方案，在 CI 和模拟器环境中运行测试逻辑，无需真实硬件。
:::
