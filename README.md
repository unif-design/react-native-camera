# @unif/react-native-camera

> 基于 [react-native-vision-camera](https://github.com/mrousavy/react-native-vision-camera) 5.x 的**弹窗式相机**库:`await api.open()` 弹出全屏相机,拍完 resolve 结果。

[![npm](https://img.shields.io/npm/v/@unif/react-native-camera.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/@unif/react-native-camera)
[![CI](https://github.com/unif-design/react-native-camera/actions/workflows/ci.yml/badge.svg)](https://github.com/unif-design/react-native-camera/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@unif/react-native-camera.svg?color=blue)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-unif--design.github.io-orange.svg)](https://unif-design.github.io/react-native-camera/)

## 特性

- **单拍 / 连拍 / 视频录制** — 一个 `useCamera()` Hook 统一编排
- **弹窗式交互** — `await api.open(config)`,拍完 / 取消后 Promise resolve `CameraResult`
- **手势** — 双指 pinch 变焦(`Gesture.Pinch` 乘性:起点倍数 × 手势 scale,clamp 到设备区间与软上限)、0.5x / 1x 档位药丸、点击对焦、前后摄翻转
- **低内存水印** — Skia 实时预览，iOS ImageIO/Core Image、Android BitmapFactory/Canvas 在文件边界直接烧录 JPEG(仅照片,录像无水印)
- **公开面极简** — 唯一入口 `useCamera()`,不直接暴露 vision-camera 的 `<Camera>`

## 安装

本库包含一个只依赖系统图像 API 的原生照片处理模块；相机与 UI 仍依赖以下 peers，**缺一即崩**:

```sh
yarn add @unif/react-native-camera \
  react-native-vision-camera react-native-vision-camera-worklets \
  react-native-nitro-modules react-native-nitro-image \
  @shopify/react-native-skia @dr.pogodin/react-native-fs react-native-video \
  react-native-reanimated react-native-worklets react-native-reanimated-carousel \
  react-native-gesture-handler react-native-safe-area-context react-native-svg \
  @sbaiahmed1/react-native-blur @unif/react-native-design
```

> ⚠️ **npm 安装前先加 scoped override**:`react-native-reanimated-carousel@5.0.0`
> 的 peer 范围暂未包含 Gesture Handler 3,而本库使用 Gesture Handler 3 的 Hook API。
> npm 消费端须先在根 `package.json` 加入以下配置,再执行 `npm install`:
>
> ```json
> {
>   "overrides": {
>     "react-native-reanimated-carousel": {
>       "react-native-gesture-handler": "$react-native-gesture-handler"
>     }
>   }
> }
> ```
>
> `$react-native-gesture-handler` 会复用根依赖中的 RNGH 3,不要改成全局 override,
> 也不要用 `--force` 绕过 peer 检查。完整说明见下方文档站链接。

> `package.json` 的 `peerDependencies` 另声明了 `react-native-webview`(历史保留,`src` 未直接引用),并含 `react` / `react-native` 本身。**完整、权威的清单以 `package.json` 的 `peerDependencies` 为准。**

> ⚠️ **文件系统用 fork**:本库依赖 `@dr.pogodin/react-native-fs`,**不是** `react-native-fs`,装错会冲突。
> ⚠️ **worklets 必装**:vision-camera 5.x 内部 `require` 了 `react-native-vision-camera-worklets`,缺它 Metro 报 `Unable to resolve module react-native-vision-camera-worklets`。

安装本库或升级原生依赖后须重新 `cd ios && bundle exec pod install`。使用相机必须声明 Camera 权限,只有启用录像才需要 Microphone 权限;本库只返回临时文件,不读写系统相册,因此不会无条件要求相册权限。完整原生配置与 peer 清单见[文档站 · 安装](https://unif-design.github.io/react-native-camera/docs/getting-started/installation)。相机的确认弹窗 / toast 已内部自洽,**无需为相机挂 `<ConfirmHost/>` / `<ToastHost/>`**。

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
    // 0 取消 / 403 相机权限 / 404 无设备 / 500 配置非法 / 503 保留码
  };

  return (
    <View>
      <Button title="拍照" onPress={onShoot} />
      {holder}{/* ← 缺 holder 时相机不弹,有效 open Promise 会保持 pending */}
    </View>
  );
}
```

`open(config)` 会先做运行时校验:非法配置直接 resolve `500/invalid_config`,不会替换当前有效会话;第二次合法 `open()` 会先以 `code: 0` 取消旧会话,再启动新会话。`close()`、Hook 卸载和过期回调都受当前会话门禁保护,同一个 Promise 最多 resolve 一次。

请求的前/后摄不可用时会自动 fallback 到另一侧，返回文件的 `cameraType` 始终是实际选中的设备。照片按最终画幅请求 FHD，并由 `capturePhotoToFile()` 直接落临时 JPEG；设备协商尺寸仍偏大/偏画幅或存在可见水印时，才进入原生文件 processor。处理失败时相机留在当前会话显示“照片处理失败，请重试”，保留此前文件，**不会**以错误 raw / 半成品完成 `open()`；录像不经过照片 processor。

返回的 `code: 200` 文件仍在临时目录。库会在 resolve 前把这些路径同步 transfer 给消费者，此后取消、删除、重拍、切模式、关闭、supersede、卸载和过期回调会 best-effort 回收其余仍归库所有的临时文件；transfer 不代表已保存到相册或持久化。长期使用请在 `200` 后自行复制到业务目录或上传。

> 完整相机链路需真机(摄像头硬件 + 原生文件照片处理);模拟器 / web 不能覆盖 IOSurface、Jetsam 与旧设备峰值内存,属预期限制。

## Example 场景展厅

仓库内的 [`example`](example/README.md) 是基于 React Native 0.86.3、React 19.2.3 与
Design 0.30.0 的中文消费方参考实现。它在根部只装配一次 `useCamera()` 与 holder，并提供
四个可往返比较的场景：

- **基础拍摄**：单拍、连拍或录像的最小 `OpenConfig`，可选择初始镜头与闪光。
- **多模式**：一次传入三种 mode，对比 `dataRetainedMode` 的 `clear` / `retain`。
- **水印存证**：把标题、手工地点、备注与当前时间烧入 JPEG；不请求定位。
- **质量实验室**：区分 SDK 默认与显式照片质量、HDR、录像时长和码率。

从仓库根目录安装并启动 Metro：

```sh
yarn install --immutable
yarn example start
```

Pods、真机运行、公开 `OpenConfig` 边界、六种结果码、临时文件所有权及复制步骤见
[`example/README.md`](example/README.md)。模拟器可用于检查普通 React Native 界面和
mock 测试，但不能验收真实摄像头、录像、水印成片或峰值内存。

## 原生接入门禁

- Babel 必须启用 `react-native-worklets/plugin`，并把它放在 `plugins` **最后一项**；相机的 pinch / 动画依赖 worklet runtime。
- 相机 Modal 内部已自带 `flex: 1` 的 `GestureHandlerRootView`，相机手势不依赖宿主 App 根；只有消费者其它页面也使用 Gesture Handler 时，才按自身需求配置宿主 root。
- 安装所有 native peer 后，iOS 必须执行 `cd ios && bundle exec pod install`。
- 权限只按实际能力配置：`CAMERA` / `NSCameraUsageDescription` 必需；只有使用 `video` 时才加 `RECORD_AUDIO` / `NSMicrophoneUsageDescription`。本库不写系统相册，因此不无条件要求 `NSPhotoLibraryAddUsageDescription` 或 `READ_MEDIA_IMAGES`。
- Camera 权限拒绝才对应结果 `403`；Microphone 拒绝会留在当前录像 session 显示可重试错误，不会被映射成 `403` 或 `503`。`503` 是兼容保留码，当前 production 没有触发路径，只在 official mock / 结果展示层验证。

## 文档

- 完整文档(安装 · 原生配置 · API · 水印 · 测试 · 故障排查 · 升级):**https://unif-design.github.io/react-native-camera/**
- 喂给 AI 的纯 Markdown:[llms.txt](https://unif-design.github.io/react-native-camera/llms.txt) · [llms-full.txt](https://unif-design.github.io/react-native-camera/llms-full.txt)
- **Agent Skill** `camera`(`unif` plugin):`/plugin marketplace add unif-design/skills` → `/plugin install unif@skills`

## 兼容性

| 项 | 要求 |
| --- | --- |
| 当前仓库开发 / example 验证 | React Native **0.86.3**、React **19.2.3**、Design **0.30.0** |
| 发布包 React Native peer | **>=0.86.0**(仅新架构 Fabric + Nitro;旧架构不支持) |
| 发布包 React peer | >=19.0.0 |
| 发布包 Design peer | **>=0.26.0** |
| iOS / Android | iOS 15.1+ / Android API 24+ |

## 许可

MIT
