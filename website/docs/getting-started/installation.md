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
| React Native | **0.86+**(仅新架构 Fabric + TurboModules) |
| React | 19+ |
| iOS | 15.1+ |
| Android | API 24+(Android 7.0) |

:::note 为什么最低 iOS 是 15.1
本库自身的原生照片处理 Pod 继承 React Native 的 `min_ios_version_supported`，只链接 ImageIO / Core Image / CoreText 等系统 framework。连同全部 peer 取最高下限后，整体最低仍为 **iOS 15.1**。
:::

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
  @sbaiahmed1/react-native-blur @unif/react-native-design
```
:::

各包的作用与版本约束:

| 包 | 版本约束 | 作用 |
| --- | --- | --- |
| `react-native-vision-camera` | `^5.0.0` | 底层相机引擎 |
| `react-native-vision-camera-worklets` | `^5.0.0` | vision-camera 5.x 内部懒 `require`,**必装**(见下) |
| `react-native-nitro-modules` | `*` | vision-camera 5.x 的 Nitro 运行时 |
| `react-native-nitro-image` | `*` | Nitro 图像桥 |
| `@shopify/react-native-skia` | `>=2` | 取景器水印实时预览 |
| `@dr.pogodin/react-native-fs` | `>=2` | 临时路径与 owned file 清理(**fork,非 `react-native-fs`**,见下) |
| `react-native-video` | `>=7.0.0-beta.0` | 录像预览播放 |
| `react-native-reanimated` | `>=4.5.0 <4.6.0` | 取景器 / 预览动画 |
| `react-native-worklets` | `>=0.11.0 <0.12.0` | reanimated 4 / vision-camera 的 worklet 运行时 |
| `react-native-reanimated-carousel` | `>=5.0.0 <6.0.0` | 预览页轮播 |
| `react-native-gesture-handler` | `>=3.0.0 <4.0.0` | pinch 变焦 / 对焦手势 |
| `react-native-safe-area-context` | `>=5.0.0` | 安全区适配 |
| `react-native-svg` | `>=15` | 矢量绘制(design `Icon` 等) |
| `@sbaiahmed1/react-native-blur` | `>=4` | 界面毛玻璃 |
| `@unif/react-native-design` | `>=0.26.0` | 图标(`Icon`)、按钮、字号/字重与颜色 token、缩放工具 `r()` |

:::caution npm 需要 scoped override
`react-native-reanimated-carousel@5.0.0` 的 peer 范围暂未包含 Gesture Handler 3,
而本库使用 Gesture Handler 3 的 Hook API。使用 npm 安装时,请在消费端根
`package.json` 加入**仅作用于 Carousel 的 scoped override**,再执行 `npm install`:

```json
{
  "overrides": {
    "react-native-reanimated-carousel": {
      "react-native-gesture-handler": "$react-native-gesture-handler"
    }
  }
}
```

不要使用全局 override 或 `--force`。上面的 `$react-native-gesture-handler` 会复用消费端
根依赖中满足 `>=3.0.0 <4.0.0` 的版本,避免安装第二份 Gesture Handler。
:::

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

本库依赖的是 **fork** —— `@dr.pogodin/react-native-fs`(临时路径与 session 文件清理用它；照片内容不会经它做 Base64 写回)。它与社区原版 `react-native-fs` **是两个包**,装错或两者并存都会导致原生符号冲突。

```sh
# ❌ Incorrect:装成非 fork 的包,会冲突
yarn add react-native-fs

# ✅ Correct:装这个 fork
yarn add @dr.pogodin/react-native-fs
```

若 `package.json` 里已混进 `react-native-fs`,先卸掉它再装 fork。

</details>

---

## 2. 配置 Babel 与相机手势根

worklet 动画与 Modal 内 pinch / 点击手势需要 Babel plugin。它必须是 `plugins` 的**最后一项**：

```js title="babel.config.js"
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // 其它 plugin 在前
    'react-native-worklets/plugin',
  ],
};
```

不要在 `react-native-worklets/plugin` 后追加其它 plugin，也不要改成
`react-native-reanimated/plugin`。相机使用独立 native Modal，库已在 **Modal 内部**
包好 `flex: 1` 的 `GestureHandlerRootView`；pinch 变焦与点击对焦不要求消费者再为相机
包 App 根。宿主其它页面是否使用 `GestureHandlerRootView`，只按消费者自身手势依赖决定。

---

## 3. 配置权限 {#权限配置}

### iOS（Info.plist）

在 `ios/<AppName>/Info.plist` 中声明实际使用的权限。`NSCameraUsageDescription` 是使用本库的必需项;只有配置并使用 `video` 模式时才需要 `NSMicrophoneUsageDescription`:

| Key | 说明 |
| --- | --- |
| `NSCameraUsageDescription` | **必需**。使用摄像头拍照 / 录像时展示给用户的说明文字 |
| `NSMicrophoneUsageDescription` | **仅 video 模式需要**。录制视频时展示给用户的说明文字 |

```xml title="ios/<AppName>/Info.plist"
<key>NSCameraUsageDescription</key>
<string>需要访问摄像头以拍摄照片和视频</string>
<!-- 只有 App 使用 video 模式时才添加 -->
<key>NSMicrophoneUsageDescription</key>
<string>录制视频时需要使用麦克风</string>
```

本库把拍摄结果作为 App 临时目录中的文件返回,**不会写入或读取系统相册**,因此接入本库本身不要求 `NSPhotoLibraryAddUsageDescription`。若消费 App 另外实现“保存到系统相册”或“从相册选择”,请按对应 Photos API / 第三方库的要求单独声明权限。

### Android（AndroidManifest.xml）

在 `android/app/src/main/AndroidManifest.xml` 的 `<manifest>` 节点下添加:

| 权限 | 说明 |
| --- | --- |
| `android.permission.CAMERA` | **必需**。拍照 / 录像所需的摄像头权限 |
| `android.permission.RECORD_AUDIO` | **仅 video 模式需要**。录制视频时的麦克风权限 |

```xml title="android/app/src/main/AndroidManifest.xml"
<uses-permission android:name="android.permission.CAMERA" />
<!-- 只有 App 使用 video 模式时才添加 -->
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

本库不读取系统相册,因此接入本库本身不要求 `android.permission.READ_MEDIA_IMAGES`。消费 App 若另有读取 / 选择相册图片的功能,请按目标 Android 版本和所用 Photo Picker / MediaStore 方案单独配置。

---

## 4. 原生编译

### iOS:pod install

安装或升级依赖后,**必须重新执行 pod install**:

```sh
cd ios && bundle exec pod install
```

:::warning 安装本库或升级原生包后必跑 pod install
本库自身含 Codegen TurboModule；`react-native-vision-camera`、`@shopify/react-native-skia`、`@dr.pogodin/react-native-fs`、`react-native-video`(7.x)也含原生代码。安装或升级后都需重新 `pod install`,否则运行时或编译期会报模块/符号缺失。
:::

完成后用 Xcode 或 `npx react-native run-ios` 重新编译运行。

### Android

Android 端无需额外配置,Gradle 自动同步。直接 `npx react-native run-android` 即可。

---

## 5. 弹窗 / Toast 无需额外挂载 Host

相机的**二次确认弹窗 / Toast 是内部自洽的** —— 由相机 Modal 子树内的本地弹窗系统(`CameraDialogHost`)渲染,**不依赖** `@unif/react-native-design` 的全局 `ConfirmHost` / `ToastHost`。因此接入本库时:

- **无需为相机在 App 根挂 `<ConfirmHost />` / `<ToastHost />`** —— 切模式 / 放弃拍摄的确认弹窗、保存提示 Toast 都直接显示在相机之上,开箱即用。
- 相机内部用 `ThemeProvider`(强制深色 token)+ `useColors`,模态内 UI 不依赖宿主的主题 Provider。

:::note 为什么相机要用本地弹窗
相机是全屏 RN `<Modal>`。design 的 `ConfirmHost` / `ToastHost` 挂在消费者 App 根节点,而 App 根的弹窗 / Toast **无法叠加到已经 present 的相机 Modal 之上**(会被相机盖住)。所以相机内部改用挂在相机 Modal 子树里的高 `zIndex` 浮层渲染确认弹窗 / Toast,确保正常显示。

> 这是本库自身的设计;若你在**相机之外**使用 design 的命令式 `confirm` / `toast`,仍需按 design 文档在 App 根挂 `ConfirmHost` / `ToastHost`。
:::

---

## 下一步

- [快速上手](/docs/getting-started/quick-start) —— 5 分钟跑通第一次拍照
- [核心概念](/docs/getting-started/concepts) —— 理解模态相机的心智模型
- [API 参考 → useCamera](/docs/api/use-camera) —— 完整 API 文档
