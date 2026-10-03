---
sidebar_position: 3
title: 类型
description: '本库公开参数、返回结果与错误类型。'
---

# 公共类型

运行时入口只有 `useCamera`；下列类型均从 `@unif/react-native-camera` 导入。输入与媒体集合支持只读数组。

## CameraInput {#camerainput}

```ts
interface CameraInput {
  modes: readonly CameraModeOptions[];
  initialFacing?: CameraFacing;
  initialFlash?: CameraFlash;
  retention: 'clear' | 'retain';
  watermark?: CameraWatermark;
}
type CameraFacing = 'front' | 'back';
type CameraFlash = 'auto' | 'on' | 'off';
```

| 字段            | 行为                                                                     |
| --------------- | ------------------------------------------------------------------------ |
| `modes`         | 至少一项且模式不重复；数组顺序是模式顺序，首项是初始模式                 |
| `initialFacing` | 初始镜头请求，默认 `back`；不可用时按实际设备选择，媒体记录实际 `facing` |
| `initialFlash`  | 初始闪光，默认 `auto`；之后由相机控件修改                                |
| `retention`     | `retain` 保留切换前媒体；`clear` 在有媒体时先请求丢弃确认                |
| `watermark`     | 照片文字水印；位置默认 `top-right`                                       |

## CameraModeOptions {#cameramodeoptions}

```ts
interface CameraPhotoMode {
  mode: 'single' | 'continuous';
  quality?: number;
  qualityPriority?: 'speed' | 'balanced' | 'quality';
  hdr?: boolean;
}
interface CameraVideoMode {
  mode: 'video';
  maxDurationSeconds?: number;
  bitRate?: number;
}
type CameraModeOptions = CameraPhotoMode | CameraVideoMode;
type CameraCaptureMode = CameraModeOptions['mode'];
```

- `quality` 是有限的 `0..1` JPEG 编码质量。显式指定时参与真实编码；未指定且必须编码时使用 `0.9`，已经满足输出要求的照片可以直接交付。
- `qualityPriority` 与 `hdr` 仅用于照片模式；不传时不额外设置 SDK 偏好。显式 `speed` 请求在设备不支持该优先级时，或 `hdr: true` 在设备不支持照片 HDR 时，快门会反馈局部配置错误并保留本轮媒体，不发起原生拍照。
- `maxDurationSeconds` 是录像自动停止上限，必须是有限正数；不传则没有自动停止上限。
- `bitRate` 是录像目标码率（bps），必须是原生编码器能表示的正整数（最大 2,147,483,647）；不传时使用 SDK 默认。显式能力按 SDK 实际支持处理，不把无法执行的偏好当作已经满足。

## CameraWatermark {#camerawatermark}

```ts
interface CameraWatermark {
  lines: readonly string[];
  position?:
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';
}
```

每个字符串是一行，`lines: []` 不生成水印。水印由调用方提供，写入照片像素，不作用于录像，也不提供防篡改证明。

## CameraOutcome {#cameraoutcome}

```ts
interface CameraSelected {
  status: 'success';
  media: readonly CameraMedia[];
}
interface CameraCancelled {
  status: 'cancelled';
}
interface CameraFailed {
  status: 'failed';
  error: CameraFailure;
}
type CameraOutcome = CameraSelected | CameraCancelled | CameraFailed;
interface CameraFailure {
  reason:
    | 'invalid_input'
    | 'permission_denied'
    | 'no_device'
    | 'unavailable'
    | 'unsupported';
  message: string;
}
```

| 结果                         | 含义                                           |
| ---------------------------- | ---------------------------------------------- |
| `success`                    | 用户选用了本轮媒体，读取 `media`               |
| `cancelled`                  | 用户退出、所属信号取消、被新调用接替或宿主结束 |
| `failed / invalid_input`     | 配置未通过校验，不影响当前有效调用             |
| `failed / permission_denied` | 相机权限被拒绝                                 |
| `failed / no_device`         | 没有可用摄像设备                               |
| `failed / unavailable`       | 宿主未挂载，或无法开启、维持整轮交互           |
| `failed / unsupported`       | 当前平台不支持拍摄，例如 Web                   |

取消和预期失败通过结果返回。局部拍照、录像或照片处理错误留在相机内提示，保留已拍媒体，允许明确重试或取消。

## CameraMedia {#cameramedia}

```ts
interface CameraMedia {
  id: string;
  uri: string;
  mode: CameraCaptureMode;
  facing: CameraFacing;
  mimeType: 'image/jpeg' | 'video/mp4';
  width: number;
  height: number;
  durationMs?: number;
}
```

`uri` 是可读的本地 file URI；尺寸和方向对应实际产物。`durationMs` 只在取得真实时长时提供，单位是毫秒。`id` 用于展示与交付，不是业务照片 ID。类型中没有另一个同义文件路径、模式别名或翻拍识别字段。

成功交付后，文件使用与释放由调用方负责；媒体仍在临时目录，长期使用应及时复制或上传。`success` 不表示上传或业务保存完成。

## CameraController 与 CameraCallOptions {#cameracontroller}

```ts
interface CameraCallOptions {
  signal?: AbortSignal;
}
interface CameraController {
  open(
    input: Readonly<CameraInput>,
    options?: CameraCallOptions
  ): Promise<CameraOutcome>;
}
```

用每次调用自己的 `AbortController` 取消。完整生命周期见 [CameraController](/docs/api/camera-api)。
