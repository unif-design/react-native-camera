---
sidebar_position: 6
title: 常见问题
description: "@unif/react-native-camera 排障决策树：相机黑屏（权限 / 缺 holder）、Unable to resolve（缺 peerDeps / worklets）、水印不出现（仅 JPEG）、模拟器 / Web 不工作（须真机 + Skia）、result code 处理。"
---

# 常见问题

按**症状 → 原因 → 解法**排查。多数问题集中在「缺 holder」「缺 peerDeps」「不在真机上跑」三类。

---

## 症状:相机打开后画面全黑 / `api.open()` 没反应

两个最常见原因,逐一排查:

### 因 1:`holder` 没渲染进树 → `api.open()` 静默无效

`useCamera()` 返回的 `holder` 必须出现在 React 树里,否则相机不弹、`api.open()` 什么都不做。

```tsx
// ❌ Incorrect:拿了 holder 却没放进树
const [api, holder] = useCamera();
return <Button title="拍照" onPress={() => api.open(cfg)} />; // api.open() 什么都不做

// ✅ Correct:holder 必须在 React 树里(位置不限)
const [api, holder] = useCamera();
return (
  <View>
    <Button title="拍照" onPress={() => api.open(cfg)} />
    {holder}
  </View>
);
```

### 因 2:缺权限声明(画面黑但模态弹出了)

模态弹出但取景画面全黑,通常是**缺权限键**:

- **iOS** —— `ios/<App>/Info.plist` 缺 `NSCameraUsageDescription`(录像还需 `NSMicrophoneUsageDescription`、存相册需 `NSPhotoLibraryAddUsageDescription`)。
- **Android** —— `android/app/src/main/AndroidManifest.xml` 缺 `android.permission.CAMERA`(录像需 `RECORD_AUDIO`,读图需 `READ_MEDIA_IMAGES`)。

补齐后重新编译(iOS 还要 `pod install`)。完整权限键见[安装 → 权限配置](/docs/getting-started/installation#权限配置)。若权限本身被用户拒绝,`api.open()` 会 resolve `code: 403`,按下文处理。

---

## 症状:打包 / 运行报 `Unable to resolve module ...`

缺同伴包。peerDeps **缺一即崩**,最常漏的是 `react-native-vision-camera-worklets`。

### `Unable to resolve module react-native-vision-camera-worklets`

```sh
# ❌ Incorrect:只装相机引擎,缺 worklets
yarn add @unif/react-native-camera react-native-vision-camera

# ✅ Correct:补 worklets(版本与 vision-camera 对齐,同为 ^5.x)
yarn add react-native-vision-camera-worklets
cd ios && bundle exec pod install
```

:::danger 为什么没用 Frame Processor 也要装 worklets
vision-camera 5.x 内部对 `react-native-vision-camera-worklets` 做了懒 `require`,Metro 在静态分析阶段就会解析它。**即使本库不使用 Frame Processor**,缺这个包打包期也会报 `Unable to resolve module react-native-vision-camera-worklets`,运行时报 `Cannot use Frame Processors - react-native-vision-camera-worklets is not installed`。
:::

### 其他 `Unable to resolve` / 原生符号缺失

逐项核对[安装 → 完整 peer 清单](/docs/getting-started/installation#安装依赖)是否装齐。两个易错点:

- **文件系统装错包** —— 本库用 fork `@dr.pogodin/react-native-fs`,**不是** `react-native-fs`。装错或两者并存会冲突,先卸 `react-native-fs` 再装 fork。
- **升级原生包后没 `pod install`** —— vision-camera / Skia / fs / video 含原生代码,升级后 iOS 必须重新 `cd ios && bundle exec pod install`,否则报原生符号缺失。

---

## 症状:照片上没出现水印

### 因 1:对录像加水印(水印仅照片)

```ts
// ❌ Incorrect:期望 video 出水印
await api.open({ cameraMode: [{ mode: 'video' }], dataRetainedMode: 'clear',
  watermark: { content: ['现场'] } }); // 录像不会有水印
```

**水印仅对照片(`image/jpeg`)生效,录像(`video/mp4`)没有水印。** 这是设计行为。

### 因 2:缺水印依赖

水印靠 `@shopify/react-native-skia` 离屏合成、`@dr.pogodin/react-native-fs` 读写临时文件,缺任一都会让水印静默失效:

```sh
yarn add @shopify/react-native-skia @dr.pogodin/react-native-fs
cd ios && bundle exec pod install
```

> 烧图本身有兜底:解码 / 读写异常时返回原图,拍摄照常成功(`code: 200`),只是没烧上水印。水印是**可视标记,不是防篡改手段**。用法见[指南 → 水印](/docs/guides/watermark)。

---

## 症状:相机 / 水印在模拟器或浏览器里跑不起来

✅ **这是预期行为,不是 bug。** vision-camera 依赖真实相机硬件,模拟器不提供相机访问;水印合成依赖 Skia GPU 渲染,模拟器上可能异常。**相机和水印请始终在真机上验证。**

:::tip 在 CI / 模拟器里测逻辑
不要在模拟器里测真实拍摄。单元测试用[测试(Mock)](/docs/testing)页的 `jest.mock` 方案,在无硬件环境跑通拍照流程逻辑。
:::

---

## 处理 `api.open()` 的 result code

`api.open()` 永远 resolve(取消也不 reject),按 `code` 兜底:

```ts
const res = await api.open(cfg);
switch (res.code) {
  case 200: use(res.data); break;        // 成功:取文件
  case 0:   /* 用户取消,静默 */ break;
  case 403: /* 无权限:引导去系统设置 */ break;
  case 404: /* 无摄像设备:提示不支持 */ break;
  case 500: /* 拍摄失败 / 配置非法 */ break;
  case 503: /* 录像失败 */ break;
}
```

```ts
// ❌ Incorrect:把 0 当成功 —— 取消时 data 为空
if (res.code === 0) use(res.data);

// ✅ Correct:只有 200 是成功
if (res.code === 200) use(res.data);
```

各 code 含义见[核心概念 → result code](/docs/getting-started/concepts)。

---

## iOS:`pod install` 报 LICENSE 警告

```
[!] The `...` pod ... has a license ... which doesn't provide any official binaries...
```

✅ **无害,可忽略。** 这是 CocoaPods 对部分非标准 LICENSE 的提示,不影响编译和运行。
