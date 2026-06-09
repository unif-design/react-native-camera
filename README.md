# @unif/react-native-camera

> 基于 [react-native-vision-camera](https://github.com/mrousavy/react-native-vision-camera) 5.x 的**弹窗式相机**库:`await api.open()` 弹出全屏相机,拍完 resolve 结果。

[![npm](https://img.shields.io/npm/v/@unif/react-native-camera.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/@unif/react-native-camera)
[![CI](https://github.com/unif-design/react-native-camera/actions/workflows/ci.yml/badge.svg)](https://github.com/unif-design/react-native-camera/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@unif/react-native-camera.svg?color=blue)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-unif--design.github.io-orange.svg)](https://unif-design.github.io/react-native-camera/)

## 特性

- **单拍 / 连拍 / 视频录制** — 一个 `useCamera()` Hook 统一编排
- **弹窗式交互** — `await api.open(config)`,拍完 / 取消后 Promise resolve `CameraResult`
- **手势** — 滚条变焦(连续、对数曲线、含 0.5x 超广角档)、点击对焦、前后摄翻转
- **Skia 水印** — 拍照后将文字水印离屏烧入成片(仅照片,录像无水印)
- **公开面极简** — 唯一入口 `useCamera()`,不直接暴露 vision-camera 的 `<Camera>`

## 安装

本库的原生能力全部来自同伴包,运行时实际用到的 peers 如下,**缺一即崩**:

```sh
yarn add @unif/react-native-camera \
  react-native-vision-camera react-native-vision-camera-worklets \
  react-native-nitro-modules react-native-nitro-image \
  @shopify/react-native-skia @dr.pogodin/react-native-fs react-native-video \
  react-native-reanimated react-native-worklets react-native-reanimated-carousel \
  react-native-gesture-handler react-native-safe-area-context react-native-svg \
  @sbaiahmed1/react-native-blur @unif/react-native-design
```

> `package.json` 的 `peerDependencies` 另声明了 `react-native-webview`(历史保留,`src` 未直接引用),并含 `react` / `react-native` 本身。**完整、权威的清单以 `package.json` 的 `peerDependencies` 为准。**

> ⚠️ **文件系统用 fork**:本库依赖 `@dr.pogodin/react-native-fs`,**不是** `react-native-fs`,装错会冲突。
> ⚠️ **worklets 必装**:vision-camera 5.x 内部 `require` 了 `react-native-vision-camera-worklets`,缺它 Metro 报 `Unable to resolve module react-native-vision-camera-worklets`。

iOS 升级原生依赖后须重新 `cd ios && bundle exec pod install`。权限键(iOS Info.plist / Android Manifest)、为何各 peer 必装 —— 见[文档站 · 安装](https://unif-design.github.io/react-native-camera/docs/getting-started/installation)。相机的确认弹窗 / toast 已内部自洽,**无需为相机挂 `<ConfirmHost/>` / `<ToastHost/>`**。

## 快速开始

```tsx
import { useCamera, type CameraResult } from '@unif/react-native-camera';

function PhotoScreen() {
  const [api, holder] = useCamera(); // holder 必须渲染进树

  const onShoot = async () => {
    const res: CameraResult = await api.open({
      cameraMode: [{ mode: 'single', quality: 0.9 }],
      dataRetainedMode: 'clear',
    });
    if (res.code === 200) {
      // 成功:res.data 为 CustomPhotoFile[],每项含 .uri / .path / .width / .height / .mime
    }
    // 0 取消 / 403 无权限 / 404 无设备 / 500 拍摄失败 / 503 录像失败
  };

  return (
    <View>
      <Button title="拍照" onPress={onShoot} />
      {holder}{/* ← 缺 holder 相机不弹 */}
    </View>
  );
}
```

> 相机 + 水印需真机(摄像头硬件 + Skia GPU);模拟器 / web 跑不起来,属预期行为。

## 文档

- 完整文档(安装 · 原生配置 · API · 水印 · 测试 · 故障排查 · 升级):**https://unif-design.github.io/react-native-camera/**
- 喂给 AI 的纯 Markdown:[llms.txt](https://unif-design.github.io/react-native-camera/llms.txt) · [llms-full.txt](https://unif-design.github.io/react-native-camera/llms-full.txt)
- Claude Code / Cursor 等接入:Agent Skill **`using-unif-camera`**(`unif-react-native` 插件)

## 兼容性

| 项 | 要求 |
| --- | --- |
| React Native | **0.85+**(仅新架构 Fabric + Nitro;旧架构不支持) |
| React | 19+ |
| iOS / Android | iOS 15.1+ / Android API 24+ |

## 许可

MIT
