---
sidebar_position: 1
title: 安装
description: "安装 @unif/react-native-camera 及全部必装 peerDependencies（含 @dr.pogodin/react-native-fs fork 与 vision-camera-worklets），配置 iOS / Android 权限键，运行 pod install。"
---

# 安装

装齐 `@unif/react-native-camera` 的全部同伴包,配置原生权限,完成编译。**peerDeps 缺一即崩** —— 本页以 `package.json` 的 `peerDependencies` 为准逐项列出。

## 环境要求

| 要求 | 版本 |
| --- | --- |
| React Native | **0.85+**(仅新架构 Fabric + TurboModules) |
| React | 19+ |
| iOS | 14.0+ |
| Android | API 24+(Android 7.0) |

:::danger 仅支持新架构
本库依赖 Nitro Modules / vision-camera 5.x,**仅支持新架构**。旧架构(Bridge 模式)不受支持。安装前确认 `app.json` 或 `android/gradle.properties` 已启用新架构。
:::

---

## 1. 安装依赖 {#安装依赖}

以下同伴包**全部必装,缺一即崩**(以 `package.json` 的 `peerDependencies` 为准):

:::danger 完整 peer 清单
```sh
yarn add @unif/react-native-camera \
  react-native-vision-camera react-native-vision-camera-worklets \
  react-native-nitro-modules react-native-nitro-image \
  @shopify/react-native-skia @dr.pogodin/react-native-fs react-native-video \
  react-native-reanimated react-native-worklets react-native-reanimated-carousel \
  react-native-gesture-handler react-native-safe-area-context react-native-svg \
  @gorhom/bottom-sheet @sbaiahmed1/react-native-blur @unif/react-native-design
```
:::

各包的作用与版本约束:

| 包 | 版本约束 | 作用 |
| --- | --- | --- |
| `react-native-vision-camera` | `^5.0.0` | 底层相机引擎 |
| `react-native-vision-camera-worklets` | `^5.0.0` | vision-camera 5.x 内部懒 `require`,**必装**(见下) |
| `react-native-nitro-modules` | `*` | vision-camera 5.x 的 Nitro 运行时 |
| `react-native-nitro-image` | `*` | Nitro 图像桥 |
| `@shopify/react-native-skia` | `>=2` | 水印离屏合成 |
| `@dr.pogodin/react-native-fs` | `>=2` | 文件读写(**fork,非 `react-native-fs`**,见下) |
| `react-native-video` | `>=7.0.0-beta.0` | 录像预览播放 |
| `react-native-reanimated` | `>=4.0.0` | 取景器 / 预览动画 |
| `react-native-worklets` | `*` | reanimated 4 / vision-camera 的 worklet 运行时 |
| `react-native-reanimated-carousel` | `>=5.0.0-beta.0` | 预览页轮播 |
| `react-native-gesture-handler` | `>=2.21.0` | 变焦 / 对焦手势 |
| `react-native-safe-area-context` | `>=5.0.0` | 安全区适配 |
| `react-native-svg` | `>=15` | 图标 |
| `@gorhom/bottom-sheet` | `>=5` | 预览底栏 |
| `@sbaiahmed1/react-native-blur` | `>=4` | 界面毛玻璃 |
| `@unif/react-native-design` | `>=0.4.0` | 预览页 `confirm` / `toast`(见第 4 节) |

:::note 关于 `react-native-webview`
`package.json` 的 `peerDependencies` 中还列有 `react-native-webview`(`*`),这是**早期版本遗留保留**的声明,当前源码已不直接引用它。新接入无需为本库单独安装;若项目其他依赖已带它,保持原样即可。
:::

<details>
<summary>为什么 <code>react-native-vision-camera-worklets</code> 必装?</summary>

vision-camera 5.x 把 Frame Processor / 多线程能力拆到了同伴包 `react-native-vision-camera-worklets`,并在内部通过懒 `require` 引用它。**即使本库不使用任何 Frame Processor**,消费端打包器(Metro 等)在静态解析阶段仍会解析 vision-camera 内部那处 `require`——缺失该包会直接报错:

- 打包期:`Unable to resolve module react-native-vision-camera-worklets`
- 运行时:`Cannot use Frame Processors - react-native-vision-camera-worklets is not installed`

因此它是**必装的同伴包**,版本与 `react-native-vision-camera` 对齐(同为 `^5.x`)。vision-camera 自身未将其声明为 peer(视作可选),本库已在 `peerDependencies` 中显式声明,以提醒消费者一并安装。

</details>

<details>
<summary>为什么文件系统用 <code>@dr.pogodin/react-native-fs</code> 而非 <code>react-native-fs</code>?</summary>

本库依赖的是 **fork** —— `@dr.pogodin/react-native-fs`(水印烧图时读写临时文件用它)。它与社区原版 `react-native-fs` **是两个包**,装错或两者并存都会导致原生符号冲突。

```sh
# ❌ Incorrect:装成非 fork 的包,会冲突
yarn add react-native-fs

# ✅ Correct:装这个 fork
yarn add @dr.pogodin/react-native-fs
```

若 `package.json` 里已混进 `react-native-fs`,先卸掉它再装 fork。

</details>

---

## 2. 配置权限 {#权限配置}

### iOS（Info.plist）

在 `ios/<AppName>/Info.plist` 中添加以下三个权限 key:

| Key | 说明 |
| --- | --- |
| `NSCameraUsageDescription` | 使用摄像头拍照 / 录像时展示给用户的说明文字 |
| `NSMicrophoneUsageDescription` | 录制视频时需要麦克风权限,展示给用户的说明文字 |
| `NSPhotoLibraryAddUsageDescription` | 保存照片 / 视频到相册时展示给用户的说明文字 |

```xml title="ios/<AppName>/Info.plist"
<key>NSCameraUsageDescription</key>
<string>需要访问摄像头以拍摄照片和视频</string>
<key>NSMicrophoneUsageDescription</key>
<string>录制视频时需要使用麦克风</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>需要访问相册以保存拍摄的照片和视频</string>
```

### Android（AndroidManifest.xml）

在 `android/app/src/main/AndroidManifest.xml` 的 `<manifest>` 节点下添加:

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

## 3. 原生编译

### iOS:pod install

安装或升级依赖后,**必须重新执行 pod install**:

```sh
cd ios && bundle exec pod install
```

:::warning vision-camera / Skia / fs / video 升级后必跑 pod install
`react-native-vision-camera`、`@shopify/react-native-skia`、`@dr.pogodin/react-native-fs`、`react-native-video`(7.x)均含原生代码,每次升级这些包后都需重新 `pod install`,否则运行时或编译期会报原生符号缺失。
:::

完成后用 Xcode 或 `npx react-native run-ios` 重新编译运行。

### Android

Android 端无需额外配置,Gradle 自动同步。直接 `npx react-native run-android` 即可。

---

## 4. 挂载 Host 组件

本库的**预览页**(用户拍完后的确认界面)内部使用 `@unif/react-native-design` 的 `confirm` / `toast`,需消费端在 App 根节点挂载对应 Host:

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

:::warning 未挂 Host 时弹窗 / 提示静默失效
`ConfirmHost` / `ToastHost` 与 `ThemeProvider` 一样,是一次性全局挂载的基础组件。
- **缺 `ConfirmHost`**:预览页的「二次确认弹窗」不弹出,用户无法确认照片。
- **缺 `ToastHost`**:错误 / 提示 Toast 静默失效。

已在 App 根挂过 `ConfirmHost` / `ToastHost`(如已使用 design 系统其他组件)无需重复挂载。
:::

---

## 下一步

- [快速上手](/docs/getting-started/quick-start) —— 5 分钟跑通第一次拍照
- [核心概念](/docs/getting-started/concepts) —— 理解模态相机的心智模型
- [API 参考 → useCamera](/docs/api/use-camera) —— 完整 API 文档
