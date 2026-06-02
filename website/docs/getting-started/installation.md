---
sidebar_position: 1
title: 安装
description: 安装 @unif/react-native-camera 及所有必装同伴包，配置 iOS / Android 权限，完成原生编译。
---

# 安装

`@unif/react-native-camera` 是基于 [react-native-vision-camera](https://github.com/mrousavy/react-native-vision-camera) 5.x 构建的 React Native 模态相机库。本页指导你从零完成安装、权限配置和原生编译。

## 环境要求 / 兼容性

| 要求 | 版本 |
| --- | --- |
| React Native | **0.85+**（新架构 Fabric 必须开启） |
| iOS | 14.0+ |
| Android | API 24+（Android 7.0） |
| 架构 | **新架构（Fabric + TurboModules）** |

:::danger 新架构必须开启
本库依赖 Nitro Modules / vision-camera 5.x，**仅支持新架构**。旧架构（Bridge 模式）不受支持，安装前请确认 `app.json` 或 `android/gradle.properties` 中已启用新架构。
:::

---

## 1. 安装依赖

以下同伴包**全部必装**，缺一不可：

:::danger 完整 peer 清单，缺包必崩
```sh
yarn add @unif/react-native-camera \
         react-native-vision-camera \
         react-native-vision-camera-worklets \
         react-native-nitro-modules \
         react-native-nitro-image \
         react-native-reanimated \
         react-native-worklets \
         react-native-reanimated-carousel \
         react-native-video \
         @shopify/react-native-skia \
         @dr.pogodin/react-native-fs \
         react-native-gesture-handler \
         react-native-safe-area-context
```
:::

<details>
<summary>为什么 <code>react-native-vision-camera-worklets</code> 是必装的？</summary>

vision-camera 5.x 把 Frame Processor / 多线程能力拆到了同伴包 `react-native-vision-camera-worklets`，并在内部通过懒 `require` 引用它。**即使本库不使用任何 Frame Processor**，消费端打包器（Metro 等）在静态解析阶段仍会解析 vision-camera 内部那处 `require`——缺失该包会直接报错：

- 打包期：`Unable to resolve module react-native-vision-camera-worklets`
- 运行时：`Cannot use Frame Processors - react-native-vision-camera-worklets is not installed`

因此它是**必装的同伴包**，版本与 `react-native-vision-camera` 对齐（同为 `^5.x`）。vision-camera 自身未将其声明为 peer（视作可选），本库已在 `peerDependencies` 中显式声明，以提醒消费者一并安装。

</details>

---

## 2. 配置权限 {#权限配置}

### iOS（Info.plist）

在项目的 `ios/<AppName>/Info.plist` 中添加以下三个权限 key：

| Key | 说明 |
| --- | --- |
| `NSCameraUsageDescription` | 使用摄像头拍照/录像时展示给用户的说明文字 |
| `NSMicrophoneUsageDescription` | 录制视频时需要麦克风权限，展示给用户的说明文字 |
| `NSPhotoLibraryAddUsageDescription` | 保存照片/视频到相册时展示给用户的说明文字 |

```xml title="ios/<AppName>/Info.plist"
<key>NSCameraUsageDescription</key>
<string>需要访问摄像头以拍摄照片和视频</string>
<key>NSMicrophoneUsageDescription</key>
<string>录制视频时需要使用麦克风</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>需要访问相册以保存拍摄的照片和视频</string>
```

### Android（AndroidManifest.xml）

在 `android/app/src/main/AndroidManifest.xml` 的 `<manifest>` 节点下添加：

| 权限 | 说明 |
| --- | --- |
| `android.permission.CAMERA` | 拍照 / 录像所需的摄像头权限 |
| `android.permission.RECORD_AUDIO` | 录制视频时的麦克风权限 |
| `android.permission.READ_MEDIA_IMAGES` | Android 13+ 读取相册图片权限 |

```xml title="android/app/src/main/AndroidManifest.xml"
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```

---

## 3. 原生配置 / 重新编译

### iOS：pod install

安装或升级依赖后，**必须重新执行 pod install**：

```sh
cd ios && bundle exec pod install
```

:::warning react-native-video 7.x、Skia、fs 需要 pod install
`react-native-video` 7.x（`useVideoPlayer` + `VideoView` API）、`@shopify/react-native-skia`、`@dr.pogodin/react-native-fs` 均有原生代码，每次升级这三个包后都需要重新 `pod install`，否则会在运行时或编译时报原生符号缺失。
:::

执行完 pod install 后，使用 Xcode 或 `npx react-native run-ios` 重新编译运行。

### Android

Android 端无需额外配置，Gradle 自动同步。直接 `npx react-native run-android` 即可。

完成以上步骤后，参阅[快速上手](/docs/getting-started/quick-start)查看最小可运行示例。

---

## 4. 挂载 Host 组件（如使用预览确认弹窗 / Toast）

本库的**预览页**（用户拍完后的确认界面）内部使用 `@unif/react-native-design` 的 `confirm` / `toast`，需消费端在 App 根节点挂载对应 Host：

```tsx title="App.tsx（或根组件）"
import { ConfirmHost, ToastHost } from '@unif/react-native-design';

export default function App() {
  return (
    <ThemeProvider>
      {/* ... 其余 UI ... */}
      <ConfirmHost />
      <ToastHost />
    </ThemeProvider>
  );
}
```

:::warning 未挂 Host 时弹窗/提示静默失效
`ConfirmHost` / `ToastHost` 与 `ThemeProvider` 一样，是一次性全局挂载的基础组件。
- **缺 `ConfirmHost`**：预览页的「二次确认弹窗」不弹出，用户无法确认照片。
- **缺 `ToastHost`**：错误/提示 Toast 静默失效。

已在 App 根挂过 `ConfirmHost` / `ToastHost`（如使用 design 系统其他组件已挂），无需重复挂载。
:::

---

## 下一步

- [快速上手](/docs/getting-started/quick-start) — 5 分钟跑通第一次拍照
- [核心概念](/docs/getting-started/concepts) — 理解模态相机的心智模型
- [API 参考 → useCamera](/docs/api/use-camera) — 完整 API 文档
