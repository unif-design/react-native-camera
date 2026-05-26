# react-native-vision-camera 5.x 深度调研报告

- 日期：2026-05-26
- 仓库 tag：`v5.0.10`（latest stable）
- 调研源：`https://github.com/mrousavy/react-native-vision-camera` 的源码 + 官方文档（`docs/content/docs/*.mdx`）+ context7（`/mrousavy/react-native-vision-camera/v5.0.0`）+ npm registry
- 本地源码副本：`/tmp/vc-research/`（`git clone --depth=1 --branch v5.0.10`）
- 目的：为 `@unif/react-native-camera` v2.0.0 升级提供精确 API 与最佳实践依据，明确指出现有 plan 中需要修订的步骤

> 本报告中"plan"指 `docs/superpowers/plans/2026-05-26-camera-upgrade.md`，"spec"指 `docs/superpowers/specs/2026-05-26-camera-upgrade-design.md`。

---

## 1. 版本与发布

### 1.1 vision-camera

| 项 | 值 | 证据 |
|---|---|---|
| 5.0.0 GA | 是（不是 beta） | `npm view react-native-vision-camera time --json` ⇒ `"5.0.0": "2026-04-16T15:23:45.848Z"` |
| 最新稳定版 | **5.0.10**（发布于 2026-05-19） | `npm view react-native-vision-camera version` ⇒ `5.0.10` |
| dist-tags | `latest: 5.0.10`、`beta: 5.0.0-beta.12`、`rc: 3.0.0-rc.10`、`expo: 2.9.4-expo.11`、`vc2: 2.16.8`、`alpha: 1.0.0-alpha.6` | `npm view react-native-vision-camera dist-tags` |
| 5.0.0 → 5.0.10 修订节奏 | 一个月内 10 个 patch（多为 race condition / 文件名 bug 修复，无 breaking） | npm time 字段 |
| 4.x 最后版本 | 4.7.3（2025-11-12） | `npm view react-native-vision-camera time --json` |

完整版本序列（仅 5.x）：
```
5.0.0  2026-04-16
5.0.1  2026-04-16  (同日 hotfix)
5.0.2  2026-04-21
5.0.3  2026-04-21
5.0.4  2026-04-21
5.0.5  2026-04-23
5.0.6  2026-04-23
5.0.7  2026-04-27  (新增 Recorder maxDuration/maxFileSize)
5.0.8  2026-04-28  (supportedMultiCamDeviceCombinations API)
5.0.9  2026-05-05  (ProGuard 崩溃修复)
5.0.10 2026-05-19  (torch strength controls + prepareSettings)
```

### 1.2 4.x → 5.x 迁移要点（来自 GitHub Release v5.0.0 release body）

> 来源：`https://api.github.com/repos/mrousavy/react-native-vision-camera/releases/tags/v5.0.0`（WebFetch）

5.0.0 是"VisionCamera 历史上最大的一次发布"，**完全重写为基于 Nitro Modules 的架构**，五年开发周期。

性能改进：
- 原生调用速度比 Turbo-Modules 快 ~15 倍、比 Expo-Modules 快 ~60 倍
- 删除约 3000 行手写 JSI/C++ 代码

**Breaking changes 全清单**：
- **Formats API 彻底删除**（`useCameraFormat` hook + `format` prop 不再存在），替换为 Constraints API（`constraints={[{ fps: 60 }]}`）
- **输出方式重构**：原 `photo={true}`、`video={true}` 这类 boolean prop 删除，必须通过 `outputs={[photoOutput, videoOutput]}` 显式传 output object
- **拍照方法重命名**：原 `Camera ref` 上的 `takePhoto()` 删除，改为 `photoOutput.capturePhoto()`/`photoOutput.capturePhotoToFile()`，**返回的是内存中的 `Photo` Hybrid Object（非 file path）**，需要 `.dispose()`
- **录像 API 重构**：原 `Camera.startRecording()` 删除，改为 `videoOutput.createRecorder({...})` → `recorder.startRecording(onFinished, onError, onPaused?, onResumed?)`
- **Barcode Scanner 拆分**：迁移到独立包 `react-native-vision-camera-barcode-scanner`
- **Frame Processor 插件**：基于 Nitro Modules 实现，类型安全参数
- **Worklets 运行时**：默认切换到 Software Mansion 的 `react-native-worklets`（与 reanimated 4 共用）
- **Camera ref 大变化**：原 `useRef<Camera>(null)` 改为 `useRef<CameraRef>(null)`（`CameraRef` 是 interface，不是 class）
- **focus API 重命名**：原 `camera.focus(point)` 改为 `camera.focusTo(viewPoint, options?)`，自动做 view→camera 坐标转换
- **顶层 `Camera.getCameraPermissionStatus()` 等 static 方法移除**，用 `useCameraPermission()` / `VisionCamera.cameraPermissionStatus`（imperative API）替代

**无 upgrade.mdx 或 migration.mdx 文档** ⇒ 官方没有正式发布迁移指南，只能靠 release notes + 直接读 5.x 文档对比 4.x。

### 1.3 peer dependencies（5.0.10）

来源：`npm view react-native-vision-camera@5.0.10 peerDependencies`
```json
{
  "react": "*",
  "react-native": "*",
  "react-native-nitro-modules": "*",
  "react-native-nitro-image": "*"
}
```

注意：**peer 里既要 nitro-modules 也要 nitro-image**（plan 当前只列了 nitro-modules）。

### 1.4 react-native-nitro-modules / 相关库

| 包 | 最新稳定版 | 证据 |
|---|---|---|
| react-native-nitro-modules | **0.35.7**（5.0.10 实际用 0.35.6） | `npm view react-native-nitro-modules version` |
| react-native-nitro-image | 0.14.0（vision-camera 5.0.10 devDep） | `/tmp/vc-research/packages/react-native-vision-camera/package.json` |
| react-native-reanimated | 4.3.1（latest stable） | `npm view react-native-reanimated version` |
| react-native-worklets | 0.8.3（reanimated 4 peer：`0.8.x`） | `npm view react-native-worklets` |
| react-native（vision-camera 5.0.10 dev 测试） | 0.84.0 | `package.json` devDependencies |
| react（vision-camera 5.0.10 dev 测试） | 19.2.3 | 同上 |

来源：`react-native-reanimated@4.3.1` 的 peer 是：
```json
{ "react": "*", "react-native": "0.81 - 0.85", "react-native-worklets": "0.8.x" }
```
**也就是说 reanimated 4 不再"自带"worklets，需要安装 react-native-worklets**。

---

## 2. 精确 API 签名

> 所有签名摘自 `/tmp/vc-research/packages/react-native-vision-camera/src/...` 真实 TypeScript 源码（v5.0.10）。

### 2.1 `useCameraPermission()` / `useMicrophonePermission()`

来源：`src/hooks/usePermission.ts`（行 10-34, 81-101）

```ts
export type PermissionStatus =
  | 'not-determined'
  | 'authorized'
  | 'denied'
  | 'restricted'

export interface PermissionState {
  status: PermissionStatus
  requestPermission: () => Promise<boolean>
  hasPermission: boolean
  canRequestPermission: boolean
}

export const useCameraPermission: () => PermissionState
export const useMicrophonePermission: () => PermissionState
```

说明：
- `hasPermission === true` ⇔ `status === 'authorized'`
- `canRequestPermission === true` ⇔ `status === 'not-determined'`（即"还能弹系统对话框"）
- `requestPermission()` 返回 `Promise<boolean>`，`true` 代表请求后用户授权
- AppState 切到 `'active'` 时会自动 refresh permission status（hook 内 `useEffect` 注册了 AppState 监听）

### 2.2 `useCameraDevice(position, filter?)`

来源：`src/hooks/useCameraDevice.ts`（行 23-35）、`src/devices/getCameraDevice.ts`（行 5-15, 17-38）

```ts
import type { CameraPosition } from '../specs/common-types/CameraPosition'
import type { CameraDevice } from '../specs/inputs/CameraDevice.nitro'

export type CameraPosition = 'front' | 'back' | 'external' | 'unspecified'

export type PhysicalDeviceType = Extract<DeviceType,
  | 'ultra-wide-angle'
  | 'wide-angle'
  | 'telephoto'
  | 'true-depth'
  | 'lidar-depth'
  | 'time-of-flight-depth'
  | 'external'
  | 'continuity'
>

export interface DeviceFilter {
  physicalDevices?: PhysicalDeviceType[]
}

export function useCameraDevice(
  position: CameraPosition,
  filter?: DeviceFilter,
): CameraDevice | undefined
```

**核心：`physicalDevices` 的合法值是 `'wide-angle'`、`'ultra-wide-angle'`、`'telephoto'`（不带 `-camera` 后缀）。**

> ⚠️ 文档 `docs/content/docs/performance.mdx` 有笔误使用 `'wide-angle-camera'`，但所有源代码、`DeviceType.ts`、`docs/content/docs/devices.mdx`、example app 都使用无后缀格式。如使用带 `-camera` 后缀的字符串，TypeScript 会报类型错误。

### 2.3 `useCameraFormat()` —— **5.x 不存在！**

来源：搜索 `src/hooks/` 全部文件，未找到 `useCameraFormat.ts`；`src/index.ts` 也未导出。

**Format API 在 5.0.0 完全被删除**。在 5.x 中等价用法是：

```tsx
import { useCamera } from 'react-native-vision-camera'

useCamera({
  isActive: true,
  device,
  outputs: [photoOutput, videoOutput],
  constraints: [
    { resolutionBias: photoOutput },   // 优先匹配 photoOutput 的 targetResolution
    { fps: 60 },
    { photoHDR: false },
    { videoStabilizationMode: 'standard' },
  ],
  onSessionConfigSelected: (config) => console.log(config.toString()),
})
```

约束类型（`src/specs/common-types/Constraint.ts` 行 24-207）：
```ts
export interface FPSConstraint               { fps: number }
export interface VideoStabilizationModeConstraint   { videoStabilizationMode: TargetStabilizationMode }
export interface PreviewStabilizationModeConstraint { previewStabilizationMode: TargetStabilizationMode }
export interface ResolutionBiasConstraint    { resolutionBias: CameraOutput }
export interface VideoDynamicRangeConstraint { videoDynamicRange: TargetDynamicRange }
export interface PhotoHDRConstraint          { photoHDR: boolean }
export interface PixelFormatConstraint       { pixelFormat: PixelFormat }
export interface BinnedConstraint            { binned: boolean }

export type Constraint =
  | FPSConstraint
  | VideoStabilizationModeConstraint
  | PreviewStabilizationModeConstraint
  | ResolutionBiasConstraint
  | VideoDynamicRangeConstraint
  | PhotoHDRConstraint
  | PixelFormatConstraint
  | BinnedConstraint
```

数组顺序 = 优先级（前面的优先级高）。约束 API 是"软约束"，永远找到最接近的可工作配置（`{ fps: 99999 }` 也不会报错）。

### 2.4 `usePhotoOutput(options?)`

来源：`src/hooks/usePhotoOutput.ts`（行 31-58）、`src/specs/outputs/CameraPhotoOutput.nitro.ts`（行 22-87）

```ts
export interface PhotoOutputOptions {
  targetResolution: Size
  containerFormat: TargetPhotoContainerFormat   // 'jpeg' | 'heic' | 'dng' | 'native'
  quality: number                                // 0.0 ~ 1.0；默认 0.9
  qualityPrioritization: QualityPrioritization   // 'speed' | 'balanced' | 'quality'
  previewImageTargetSize?: Size                  // 可选；为 undefined 则不生成 preview image
}

export function usePhotoOutput(options?: Partial<PhotoOutputOptions>): CameraPhotoOutput
```

默认值（hook 行 31-37）：
- `targetResolution = CommonResolutions.UHD_4_3` = `{ width: 3024, height: 4032 }`
- `containerFormat = 'native'`
- `quality = 0.9`
- `qualityPrioritization = 'balanced'`
- `previewImageTargetSize = undefined`

**字段说明**：
- `quality`：JPEG 压缩率（0~1），RAW (`'dng'`) 忽略此参数
- `qualityPrioritization`：`'speed'` / `'balanced'` / `'quality'`，但只有当 device.supportsSpeedQualityPrioritization 时才能用 `'speed'`
- `previewImageTargetSize`：设了它才会触发 `onPreviewImageAvailable` 回调
- `containerFormat`：可以是 `'jpeg' | 'heic' | 'dng' | 'native'`（`'native'` 表示让平台自选）

### 2.5 `useVideoOutput(options?)`

来源：`src/hooks/useVideoOutput.ts`（行 38-64）、`src/specs/outputs/CameraVideoOutput.nitro.ts`（行 18-110）

```ts
export type RecorderFileType = 'mp4' | 'mov'

export interface VideoOutputOptions {
  targetResolution: Size
  enableAudio?: boolean                  // 默认 false；启用需 mic permission
  enablePersistentRecorder?: boolean     // 默认 false；切换 device 时不中断录像
  enableHigherResolutionCodecs?: boolean // 仅 Android
  targetBitRate?: number                 // bits/秒
  fileType?: RecorderFileType            // iOS only；Android 强制 mp4
}

export function useVideoOutput(options?: Partial<VideoOutputOptions>): CameraVideoOutput
```

默认值（hook 行 38-44）：
- `targetResolution = CommonResolutions.FHD_16_9` = `{ width: 1080, height: 1920 }`

### 2.6 `<Camera>` 组件 props 完整列表

来源：`src/views/Camera.tsx`（行 78-142）+ `src/hooks/useCamera.ts`（行 30-199，`CameraProps` interface）

```ts
import type { ViewProps } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'

interface CameraProps {
  // ── Session configuration ──
  isActive: boolean

  // ── Connection configuration ──
  device: CameraDevice | CameraPosition           // 可传字符串 'back' 自动解析
  outputs?: CameraOutput[]                        // photoOutput, videoOutput, frameOutput, etc.
  constraints?: Constraint[]
  onSessionConfigSelected?: (config: CameraSessionConfig) => void
  orientationSource?: OrientationSource | 'custom'  // 'interface' | 'device' | 'custom'
  mirrorMode?: MirrorMode                          // 'on' | 'off' | 'auto'

  // ── Camera Controller configuration ──
  enableSmoothAutoFocus?: boolean                  // iOS only, default false
  enableLowLightBoost?: boolean                    // default false
  enableDistortionCorrection?: boolean             // iOS only, default true

  // ── Initial values ──
  getInitialZoom?: () => number | undefined
  getInitialExposureBias?: () => number | undefined

  // ── Callbacks ──
  onConfigured?: () => void
  onStarted?: () => void
  onStopped?: () => void
  onError?: (error: Error) => void
  onInterruptionStarted?: (interruption: InterruptionReason) => void
  onInterruptionEnded?: () => void
  onSubjectAreaChanged?: () => void                // iOS only
}

interface CameraViewProps extends CameraProps,
  Pick<ViewProps, 'style' | 'onLayout' | 'pointerEvents' | 'nativeID'>,
  Pick<PreviewViewProps, 'resizeMode' | 'implementationMode'> {

  // PreviewView extras
  onPreviewStarted?: () => void
  onPreviewStopped?: () => void
  resizeMode?: 'cover' | 'contain'                 // 默认 'cover'
  implementationMode?: 'performance' | 'compatible' // 仅 Android, 默认 'performance'

  // 内置原生手势开关
  enableNativeZoomGesture?: boolean                // 默认 false
  enableNativeTapToFocusGesture?: boolean          // 默认 false

  // 受控属性（支持 SharedValue）
  zoom?: number | SharedValue<number>              // 默认 1
  exposure?: number | SharedValue<number>          // 默认 0
  torchMode?: TorchMode                            // 'on' | 'off'

  ref?: Ref<CameraRef>
}
```

**InterruptionReason 完整枚举**（`src/specs/session/CameraSession.nitro.ts` 行 12-19）：
```ts
type InterruptionReason =
  | 'video-device-not-available-in-background'
  | 'audio-device-in-use-by-another-client'
  | 'video-device-in-use-by-another-client'
  | 'video-device-not-available-with-multiple-foreground-apps'
  | 'video-device-not-available-due-to-system-pressure'
  | 'sensitive-content-mitigation-activated'
  | 'unknown'
```

**zoom 与 enableNativeZoomGesture 互斥**（`src/views/Camera.tsx` 行 256-260）：同时设置会抛错：
```
`zoom` must not be set if `enableNativeZoomGesture` is enabled!
```

### 2.7 Camera ref 方法 —— **是 `focusTo({x,y})` 不是 `focus(point)`**

来源：`src/views/Camera.tsx`（行 35-69, 188-247）

```ts
export interface CameraRef extends PreviewViewMethods,
  Pick<CameraController, 'resetFocus' | 'startZoomAnimation' | 'cancelZoomAnimation'> {

  focusTo(viewPoint: Point, options?: FocusOptions): Promise<void>

  preview: PreviewView | undefined
  controller: CameraController | undefined
}

// 继承自 PreviewViewMethods（src/specs/views/PreviewView.nitro.ts 行 82-156）
interface PreviewViewMethods {
  createMeteringPoint(viewX: number, viewY: number, size?: number): MeteringPoint
  takeSnapshot(): Promise<Image>             // Android only
  convertCameraPointToViewPoint(cameraPoint: Point): Point
  convertViewPointToCameraPoint(viewPoint: Point): Point
  convertScannedObjectCoordinatesToViewCoordinates(scannedObject: ScannedObject): ScannedObject  // iOS
}

// 继承自 CameraController（src/specs/CameraController.nitro.ts 行 209-381）
{
  resetFocus(): Promise<void>
  startZoomAnimation(zoom: number, rate: number): Promise<void>
  cancelZoomAnimation(): Promise<void>
}
```

**FocusOptions**（`src/specs/common-types/FocusOptions.ts` 行 13-84）：
```ts
type MeteringMode = 'AE' | 'AF' | 'AWB'
type FocusResponsiveness = 'steady' | 'snappy'
type SceneAdaptiveness = 'continuous' | 'locked'

interface FocusOptions {
  responsiveness?: FocusResponsiveness         // 默认 'snappy'
  adaptiveness?: SceneAdaptiveness             // 默认 'continuous'
  modes?: MeteringMode[]                       // 默认 ['AE','AF','AWB']
  autoResetAfter?: number | null               // 默认 5 秒；null 表示不自动重置
}
```

**Point** 类型（`src/specs/common-types/Point.ts`）：`{ x: number; y: number }`

调用示例（`src/views/Camera.tsx` 行 199-208）：
```tsx
const camera = useRef<CameraRef>(null)
await camera.current.focusTo({ x: viewX, y: viewY }, {
  adaptiveness: 'continuous',
  autoResetAfter: 3,
  responsiveness: 'snappy',
})
```

`focusTo` 内部会自动调用 `previewView.createMeteringPoint(x, y)` 把 view 坐标转成 camera coordinate system，然后调用 `controller.focusTo(meteringPoint, options)`。

### 2.8 `photoOutput.capturePhoto(settings, callbacks)`

来源：`src/specs/outputs/CameraPhotoOutput.nitro.ts`（行 137-225, 310-313）

```ts
export type FlashMode = 'off' | 'on' | 'auto'

export interface CapturePhotoSettings {
  flashMode?: FlashMode                         // 默认 'off'
  enableShutterSound?: boolean                  // 默认 true
  enableDepthData?: boolean                     // 默认 false
  enableRedEyeReduction?: boolean               // 默认 true
  enableCameraCalibrationDataDelivery?: boolean // iOS only, 默认 false
  enableDistortionCorrection?: boolean          // 默认 false
  enableVirtualDeviceFusion?: boolean           // 默认 true
  location?: Location                           // GPS EXIF
}

export interface CapturePhotoCallbacks {
  onWillBeginCapture?: () => void
  onWillCapturePhoto?: () => void
  onDidCapturePhoto?: () => void
  onPreviewImageAvailable?: (previewImage: Image) => void  // 仅当 previewImageTargetSize 已设
}

// 返回 Photo Hybrid Object（in-memory）
capturePhoto(
  settings: CapturePhotoSettings,
  callbacks: CapturePhotoCallbacks,
): Promise<Photo>
```

**`Photo` 对象的完整字段**（`src/specs/instances/Photo.nitro.ts` 行 69-196）：
```ts
export interface Photo extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  readonly isMirrored: boolean
  readonly orientation: CameraOrientation             // 'up'|'right'|'down'|'left'
  readonly timestamp: number                          // 秒，主机时钟
  readonly isRawPhoto: boolean
  readonly width: number
  readonly height: number
  readonly containerFormat: PhotoContainerFormat      // 'jpeg'|'heic'|'dng'|'tiff'|'dcm'|'unknown'
  readonly hasPixelBuffer: boolean
  readonly depth?: Depth                              // 启用 enableDepthData 才有
  readonly calibrationData?: CameraCalibrationData    // iOS only

  // 方法
  getPixelBuffer(): ArrayBuffer
  saveToFileAsync(path: string): Promise<void>
  saveToTemporaryFileAsync(): Promise<string>         // 返回 fs 路径，**不带 file:// 前缀**
  getFileData(): ArrayBuffer
  getFileDataAsync(): Promise<ArrayBuffer>
  toImage(): Image                                    // react-native-nitro-image 的 Image
  toImageAsync(): Promise<Image>
  dispose(): void                                     // 来自 HybridObject 基类
}
```

⚠️ **重要：5.x 中 `Photo` 不再有 `path` 字段**——它是 in-memory 对象，必须显式 `saveToFileAsync()` 或 `saveToTemporaryFileAsync()` 才能拿到路径。**plan/spec 中假设 `photo.path` 直接可用是错的。**

### 2.9 `photoOutput.capturePhotoToFile(settings, callbacks)`

来源：`src/specs/outputs/CameraPhotoOutput.nitro.ts`（行 230-236, 326-329）

```ts
export interface PhotoFile {
  filePath: string                              // 文件系统绝对路径（不是 file:// URL）
}

capturePhotoToFile(
  settings: CapturePhotoSettings,
  callbacks: CapturePhotoCallbacks,
): Promise<PhotoFile>
```

返回的对象**仅有 `filePath` 字段**（没有 width/height/orientation 等），如需要这些信息要用 `capturePhoto()` 然后 `await photo.saveToTemporaryFileAsync()`。

文档明确：**`filePath` 是文件系统路径不是 `file://` URL，调用方需要自行拼接 `file://` 前缀**（`docs/content/docs/photo-output.mdx`）：
> "filePath is a plain filesystem path, not a file:// URL. If another library expects a URI, prepend file:// at the call site."

### 2.10 录像 API —— **不是 videoOutput.startRecording**

来源：`src/specs/outputs/CameraVideoOutput.nitro.ts`（行 207-244）+ `src/specs/outputs/Recorder.nitro.ts`（行 35-120）

5.x 的录像是两阶段：先用 `videoOutput.createRecorder(settings)` 创建 `Recorder`，再用 `recorder.startRecording(...)` 开始：

```ts
interface CameraVideoOutput extends CameraOutput {
  getSupportedVideoCodecs(): VideoCodec[]               // iOS only
  setOutputSettings(settings: VideoOutputSettings): Promise<void>  // iOS only
  createRecorder(settings: RecorderSettings): Promise<Recorder>
}

interface RecorderSettings {
  location?: Location
  filePath?: string                  // 不指定就用临时目录
  maxDuration?: number               // 秒
  maxFileSize?: number               // 字节
}

interface Recorder extends HybridObject<...> {
  readonly isRecording: boolean
  readonly isPaused: boolean
  readonly recordedDuration: number  // 秒
  readonly recordedFileSize: number  // 字节
  readonly filePath: string

  startRecording(
    onRecordingFinished: (filePath: string, reason: RecordingFinishedReason) => void,
    onRecordingError: (error: Error) => void,
    onRecordingPaused?: () => void,
    onRecordingResumed?: () => void,
  ): Promise<void>

  stopRecording(): Promise<void>
  pauseRecording(): Promise<void>
  resumeRecording(): Promise<void>
  cancelRecording(): Promise<void>
}

type RecordingFinishedReason =
  | 'stopped'
  | 'max-duration-reached'
  | 'max-file-size-reached'
```

**关键性质**：
- 一个 `Recorder` 只能录一次。要录第二段必须 `await videoOutput.createRecorder({})` 重新创建。
- `startRecording` 接收**回调函数**而非 options object。无 `flash` 字段（视频补光需通过 `controller.setTorchMode('on')` 或 Camera 的 `torchMode` prop 控制）。
- `filePath` 是文件系统路径，**不是 `file://` URL**（文档明确）。

完整 example 代码（`apps/simple-camera/src/screens/CameraScreen.tsx` 行 176-219）：
```tsx
const recorder = await videoOutput.createRecorder({})
await recorder.startRecording(
  (path, reason) => { console.log(`Recording finished! ${reason}`, path) },
  (error) => { console.error('Failed to record', error) },
  () => console.log('Paused'),
  () => console.log('Resumed'),
)
// later
await recorder.stopRecording()
```

### 2.11 其他相关 API

| 名称 | 签名 | 来源 |
|---|---|---|
| `useCameraDevices()` | `() => CameraDevice[]` | `src/hooks/useCameraDevices.ts` |
| `useCameraDeviceExtensions(device)` | `(device) => CameraExtension[] \| undefined`（Android only） | `src/hooks/useCameraDeviceExtensions.ts` |
| `useOrientation(source)` | `(source) => CameraOrientation \| undefined` | `src/hooks/useOrientation.ts` |
| `getCameraDevice(devices, position, filter?)` | 同步函数版本，用于 imperative API | `src/devices/getCameraDevice.ts` |
| `getDefaultCameraDevice(position)` | `Promise<CameraDevice \| undefined>` | `src/CameraDevices.ts` |
| `getAllCameraDevices()` | `() => CameraDevice[]` | `src/CameraDevices.ts` |
| `addOnCameraDevicesChangedListener(listener)` | `ListenerSubscription` | `src/CameraDevices.ts` |
| `VisionCamera.createNormalizedMeteringPoint(x, y, size?)` | `MeteringPoint`，归一化坐标 0~1 | `src/specs/CameraFactory.nitro.ts` |
| `VisionCamera.cameraPermissionStatus` | `PermissionStatus`（同步 getter） | `src/specs/CameraFactory.nitro.ts` |
| `VisionCamera.requestCameraPermission()` | `Promise<boolean>` | 同上 |

---

## 3. Reanimated 4.x 集成

### 3.1 `addWhitelistedNativeProps` 在 reanimated 4 是 no-op

来源：通过 WebFetch 抓 `https://raw.githubusercontent.com/software-mansion/react-native-reanimated/4.3.1/packages/react-native-reanimated/src/ConfigHelper.ts`

`addWhitelistedNativeProps` 和 `addWhitelistedUIProps` 在 reanimated 4 中**仍然导出，但是 no-op 函数**（仅保留兼容性）。调用它们既不报错也无效果。

主索引 (`src/index.ts`) 不再直接 re-export 它们，需要 deep import：
```ts
import { addWhitelistedNativeProps } from 'react-native-reanimated/src/ConfigHelper'  // no-op
```

但因为它是 no-op，**根本不需要调用**。

### 3.2 vision-camera 5.x 已内置支持 SharedValue<number>

来源：`src/views/Camera.tsx` 行 118-120：
```ts
zoom?: number | SharedValue<number>
exposure?: number | SharedValue<number>
```

`src/hooks/internal/useZoomUpdater.ts` 内部已通过 `VisionCameraWorkletsProxy.bindUIUpdatesToController(zoom, controller, 'setZoom')` 直接把 SharedValue 绑到原生 controller。

**结论：5.x 中 `<Camera zoom={zoomShared} />` 直接生效，无需 `Reanimated.createAnimatedComponent(Camera)`、无需 `useAnimatedProps`、无需 `addWhitelistedNativeProps`。**

### 3.3 5.x 推荐捏合变焦写法

来源：`docs/content/docs/zooming.mdx`、`docs/content/docs/camera-view.mdx`

**方案 A（推荐）：内置原生手势 `enableNativeZoomGesture`**
```tsx
<Camera
  style={StyleSheet.absoluteFill}
  device="back"
  isActive={true}
  enableNativeZoomGesture={true}
/>
```
原生 `ZoomGestureController` 直接控制 zoom，与 `zoom` prop 互斥。无需 reanimated。

**方案 B（自定义控制）：SharedValue + Gesture.Pinch**
```tsx
import { useSharedValue } from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'

function App() {
  const zoom = useSharedValue(1)
  const zoomOffset = useSharedValue(0)
  const device = useCameraDevice('back')

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => { zoomOffset.value = zoom.value })
    .onUpdate((e) => {
      const z = zoomOffset.value * e.scale
      // clamp 在 worklet 里手动算
      zoom.value = Math.min(Math.max(z, device.minZoom), device.maxZoom)
    })

  return (
    <GestureDetector gesture={pinchGesture}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        zoom={zoom}                  // 直接传 SharedValue
      />
    </GestureDetector>
  )
}
```

注意：
- **不需要** `Reanimated.createAnimatedComponent(Camera)`
- **不需要** `useAnimatedProps`
- **不需要** `addWhitelistedNativeProps`
- 同样 `exposure` 也支持 SharedValue

### 3.4 Reanimated 4 必要的安装

来源：`react-native-reanimated@4.3.1` 的 `peerDependencies`
- `react-native: 0.81 - 0.85` ✅
- `react-native-worklets: 0.8.x` ⚠️ **必须额外安装 react-native-worklets**

reanimated 4 不再自带 worklets runtime，需要单独安装 `react-native-worklets`。Plan 和 spec **未列入** react-native-worklets 依赖。

---

## 4. 物理镜头编排

### 4.1 完整可用值

来源：`src/specs/common-types/DeviceType.ts`、`src/devices/getCameraDevice.ts`

`PhysicalDeviceType`（用于 `useCameraDevice(position, { physicalDevices })`）：
```ts
type PhysicalDeviceType =
  | 'ultra-wide-angle'
  | 'wide-angle'
  | 'telephoto'
  | 'true-depth'
  | 'lidar-depth'
  | 'time-of-flight-depth'
  | 'external'
  | 'continuity'
```

完整 `DeviceType`（除以上 physical 之外还包括 virtual 类型）：
```ts
type DeviceType =
  | 'wide-angle'
  | 'ultra-wide-angle'
  | 'telephoto'
  | 'dual'
  | 'dual-wide'
  | 'triple'
  | 'quad'
  | 'continuity'
  | 'lidar-depth'
  | 'true-depth'
  | 'time-of-flight-depth'
  | 'external'
  | 'unknown'
```

⚠️ **plan 中使用的 `'ultra-wide-angle-camera'`、`'wide-angle-camera'` 是错的**（多了 `-camera` 后缀）。正确写法：
```ts
const device = useCameraDevice('back', {
  physicalDevices: ['ultra-wide-angle', 'wide-angle'],  // ✅ 5.x 正确
})
```

### 4.2 镜头切换：用 zoom 切，不切 device

文档明确（`docs/content/docs/zooming.mdx`）：虚拟相机（如 Triple-Camera）会**自动**在物理镜头之间切换，由 `setZoom(...)` 触发。**消费方只控制 zoom 值，不切换 device**。

```ts
const device = useCameraDevice('back', {
  physicalDevices: ['ultra-wide-angle', 'wide-angle', 'telephoto'],
})

// 各物理镜头的切换点
console.log(device.zoomLensSwitchFactors)  // 例：[1, 3]（0.5x ultra-wide → 1x wide → 3x tele）

// 想切到 ultra-wide：
await controller.setZoom(device.minZoom)   // 一般是 0.5

// 想回到 wide：
await controller.setZoom(1)
```

### 4.3 ⚠️ 5.x 中没有 `device.neutralZoom`

来源：搜索 `/tmp/vc-research/packages/react-native-vision-camera/src/` 整个目录，未在 `CameraDevice.nitro.ts`（613 行接口定义）中找到 `neutralZoom` 字段。同时 GitHub issue #3845（2026-05-08 开 open）明确反映："`neutralZoom` 在 v4 中存在但在 v5 中被移除"，issue 作者也在追问如何在多镜头下确定"自然 1x"位置。

`CameraDevice` 实际暴露的 zoom 相关属性：
```ts
readonly minZoom: number
readonly maxZoom: number
readonly zoomLensSwitchFactors: number[]    // 物理镜头切换点（如 [1, 3]）
```

**结论：spec/plan 中使用的 `device.neutralZoom` 在 5.x 不存在。**替代方案：
- 直接 hardcode `1` 作为"自然 1x"
- 或者从 `device.zoomLensSwitchFactors` 推断（第一个切换点通常就是 1x）

`CameraController` 提供了 `displayableZoomFactor`（user-facing 显示值），但这是 controller 实例上的属性，不是 device 上的。

---

## 5. Nitro Modules 集成（RN 0.85 + 新架构）

### 5.1 完整安装步骤（来源：`docs/content/docs/index.mdx` Getting Started）

```bash
# 1. 核心依赖（vision-camera + 它的 peer deps）
npm install react-native-vision-camera react-native-nitro-modules react-native-nitro-image

# 2. iOS：
npx pod-install
npm run ios

# 3. Android：直接 build
npm run android
```

**Expo 用户**：用 `npx expo prebuild` + `npx expo run:ios`。

iOS 必须的 Info.plist：
```xml
<key>NSCameraUsageDescription</key>
<string>$(PRODUCT_NAME) needs access to your Camera to capture photos and videos.</string>
<key>NSMicrophoneUsageDescription</key>
<string>$(PRODUCT_NAME) needs access to your Microphone to record audio for video recordings.</string>
```

Android 必须的 AndroidManifest.xml：
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

### 5.2 iOS 最低部署版本

来源：`/tmp/vc-research/packages/react-native-vision-camera/VisionCamera.podspec` 行 13
```ruby
s.platforms = { :ios => min_ios_version_supported, :visionos => 1.0 }
```

`min_ios_version_supported` 由 React-Native 的 `react_native_pods.rb` 决定。RN 0.85 默认 `min_ios_version_supported = '15.5'`。实测 vision-camera example 应用的 Podfile 也是 `platform :ios, '15.5'`。

**结论：iOS 15.5+。**

### 5.3 Android minSdk

来源：`/tmp/vc-research/packages/react-native-vision-camera/android/gradle.properties`
```properties
VisionCamera_kotlinVersion=2.1.20
VisionCamera_minSdkVersion=23
VisionCamera_targetSdkVersion=36
VisionCamera_compileSdkVersion=36
VisionCamera_ndkVersion=27.1.12297006
```

**结论：Android API Level 23+（Android 6.0+）。Kotlin 2.1.20、AGP 9.1.0、NDK 27.1**。

### 5.4 New Architecture

source `android/build.gradle` 行 17-22：
```gradle
def isNewArchitectureEnabled() {
  return rootProject.hasProperty("newArchEnabled") &&
         rootProject.getProperty("newArchEnabled") == "true"
}
```
vision-camera 5.x 同时兼容 Old/New Architecture，但**官方 example 应用配置的是 New Architecture**（`apps/simple-camera/ios/SimpleCamera/Info.plist` 行 42-43）：
```xml
<key>RCTNewArchEnabled</key>
<true/>
```

实际 5.x 完全基于 Nitro Modules，本质上 New Arch 是推荐路径（Nitro 的设计 target 就是 New Arch）。

### 5.5 example app 实际版本组合（参考）

来源：`/tmp/vc-research/apps/simple-camera/package.json`
```json
"react": "19.2.3",
"react-native": "0.84.0",
"react-native-nitro-image": "0.14.0",
"react-native-nitro-modules": "0.35.6",
"react-native-reanimated": "4.3.0",
"react-native-worklets": "0.8.1",
"react-native-gesture-handler": "^2.30.0",
"react-native-safe-area-context": "^5.7.0",
"react-native-screens": "^4.24.0"
```

vision-camera 5.0.10 用 react-native 0.84，但同一版本声明 peer 是 `react-native: '*'`，理论上 RN 0.85 也能用——但本地副本暂未提供 0.85 验证。

---

## 6. 已知 issue 与限制

### 6.1 近 3 个月（2026-02 至 2026-05）的开源 issues 总览

| # | 标题 | 影响版本 | 平台 | 类型 |
|---|---|---|---|---|
| #3913 | UPC-A barcode in low-res screen needs zoom (iOS only) | barcode-scanner | iOS | bug |
| #3912 | `createRecorder` 生成的 mp4 文件名缺 `.` 点（`VisionCamera_1234mp4`） | **5.0.1+** | Android | bug |
| #3897 | Camera flex 布局首次 mount 错位（Android） | **5.0.9** | Android（11, 16） | bug，需 fast refresh 修复 |
| #3845 | `neutralZoom` 属性在 v5 中缺失（v4 有） | 5.x 所有 | iOS | feature/regression |
| #3834 | Android 并行 `requestPermission` 调用泄漏 coroutine（"JPromise was destroyed"） | 5.x 所有 | Android | bug |
| #3829 | Resizer in frameOutput crashes on Samsung Z Flip7（Vulkan memory） | 5.x | Android | bug，特定机型 |
| #3823 | iOS 26 simulator 无法 build barcode-scanner | 5.x | iOS 26 sim | build |
| #3773 | HybridCameraSession.start() race condition crash on iPhone 11/iOS 18.7.7（多镜头 device） | **5.0.4**（仍未修复） | iOS | crash，TestFlight 收到 6 份相同 stack |
| #3730 | iPhone 17 Pro Max/iOS 26 拆解 session 时 SIGABRT（多镜头） | 5.0.0-beta.8 | iOS | crash |

频次 ≥3 的热门问题：
- **race condition crash on multi-physical-device** (`#3730` + `#3773` + 之前的 closed sibling issues)
- **orientation 初始化 race**（PR `#3899` 在 review 中）
- **Android permission leak**（`#3834`）

### 6.2 5.0.x 严重 bug 清单

1. **iOS Multi-Camera race condition crash**（#3773）
   - 设备：iPhone 11、iPhone 17 Pro Max（任何 dual+ 物理镜头）
   - 触发：开关相机、切换 device、HDR/mute 切换
   - 状态：未修复
   - **解法/缓解**：先选择**单物理镜头**（`physicalDevices: ['wide-angle']`）启动；切换镜头通过 zoom 不通过切 device。

2. **Android Camera 首次布局错位**（#3897）
   - 设备：Android 11+、emulator
   - 表现：Camera 渲染在屏幕顶部、忽略 flex 样式，fast refresh 或 forceLayout 后恢复
   - 状态：未修复
   - **解法/缓解**：mount 时先设置 `style={StyleSheet.absoluteFill}`，并在 `onPreviewStarted` 中主动触发一次 layout 重计算

3. **Android 并行权限请求 promise 永挂**（#3834）
   - 状态：未修复
   - **解法**：所有 `requestPermission()` 调用 `.catch(() => {})` 吞错误，依赖 `hasPermission` 状态作为 source of truth

4. **Recorder 生成无扩展名 mp4**（#3912，Android 5.0.1+）
   - 状态：未修复
   - **解法**：调用方拿到 `filePath` 后手动 `rename` 加 `.mp4`，或显式传 `RecorderSettings.filePath`

5. **iOS preview 启动横屏时初始 90° 旋转**（PR #3899 review 中）
   - 状态：PR 在合并中
   - **解法/缓解**：升级至 5.0.11+ 或自行实现 orientation 监听

### 6.3 性能瓶颈与常见坑

| 坑 | 缓解（来自 docs/performance.mdx） |
|---|---|
| 启动慢 | 用单物理镜头（`physicalDevices: ['wide-angle']`），慢的是 triple-camera 等组合 |
| 拍照慢 | `qualityPrioritization: 'speed'` + `prepareSettings()` 预热 |
| 仍要更快 | 用 `previewView.takeSnapshot()`（仅 Android；iOS 不支持） |
| Video HDR 重 | 默认关 |
| Skia 渲染重 | 不用 Skia 时不要用 `<SkiaCamera />` |
| Frame Processor 转 RGB 重 | 用 YUV pixel format |
| 频繁 mount/unmount Camera | 用 `isActive` 切换，保持组件 mount |

### 6.4 Modal 内使用：无专门 open issue，但需要遵循 lifecycle 原则

GitHub search 未发现"modal"主题的 open issue（截止 2026-05-26）。但**底层 `isActive` 的官方建议直接适用于 Modal 场景**（见第 7 节）。

---

## 7. 模态化使用模式

### 7.1 Modal `visible` 与 `isActive` 协同

文档（`docs/content/docs/lifecycle.mdx`、`camera-view.mdx`）建议把 `isActive` 绑到"页面是否在前台"——对 Modal 而言就是 `visible`：

```tsx
function CameraModal({ visible, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={visible}              // ← 与 Modal visible 联动
        outputs={[photoOutput]}
      />
    </Modal>
  )
}
```

**关键事实**（lifecycle.mdx）：
- `isActive={false}` 让 Camera 保留配置只是停止流（"Ready" 状态），恢复极快
- Camera 组件完全 unmount 才会拆 session（昂贵）

**建议**：
- Modal `visible` ↔ `isActive` 一对一映射
- 关闭 Modal 时**不需要手动调 controller.stop()**，`isActive={false}` 即可
- 完全卸载 Modal 时让 holder 直接 unmount，session 会自动清理

### 7.2 横竖屏 / orientation 变化处理

`orientationSource` prop 接受 `'interface' | 'device' | 'custom'`（默认 `'device'`，见 `useCamera` 行 230）：
- `'interface'`：UI 旋转（适合 Snapchat/Instagram 风格）
- `'device'`：物理设备旋转（适合相机 App）
- `'custom'`：手动设置 `output.outputOrientation`

Modal 场景建议：
- 如果 Modal 内允许 UI 旋转且想保持取景画面与 UI 一致，用 `orientationSource="interface"`
- 如果 Modal 锁定竖屏但允许相机随物理旋转（拍照横竖兼容），用 `orientationSource="device"`（默认）

**已知坑**：iOS 启动时如果直接进入横屏，预览图可能首次旋转错（PR #3899 修复中）。

### 7.3 关闭 Modal 时是否需要手动停止相机

不需要。文档明确："`isActive={false}` 会停止 session，再次 `true` 会快速恢复。完全卸载 `<Camera />` 才会拆 session"。Modal 关闭时只要让 `<Camera>` 跟着 unmount 即可。

但**销毁照片对象**仍是消费方责任：所有未 dispose 的 `Photo` 都会消耗内存，应在 useEffect cleanup 或 settle 后调用 `photo.dispose()`。

### 7.4 热重载

文档无专门讨论，但社区反馈热重载通常需要全 mount cycle 才能正确恢复 session。建议在开发期对 Modal 内 Camera 使用 `key` prop 强制重 mount 避免状态不一致。

---

## 8. example 集成参考

### 8.1 iOS Info.plist 实例

来源：`/tmp/vc-research/apps/simple-camera/ios/SimpleCamera/Info.plist`（行 36-43）

```xml
<key>NSCameraUsageDescription</key>
<string>VisionCamera needs access to your Camera for very obvious reasons.</string>
<key>NSMicrophoneUsageDescription</key>
<string>VisionCamera needs access to your Microphone to record audio for video recordings.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>VisionCamera needs access to your Location to add GPS tags to captured photos.</string>
<key>RCTNewArchEnabled</key>
<true/>
```

iOS 配置：`platform :ios, '15.5'`（`apps/simple-camera/ios/Podfile`）。

### 8.2 Android AndroidManifest.xml 实例

来源：`/tmp/vc-research/apps/simple-camera/android/app/src/main/AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

注意：example 没声明 `uses-feature android:name="android.hardware.camera"`。

### 8.3 拍照关键代码片段

来源：`/tmp/vc-research/apps/simple-camera/src/screens/CameraScreen.tsx`（行 153-172）

```tsx
const photoOutput = usePhotoOutput({})

const takePhoto = useCallback(async () => {
  try {
    const photo = await photoOutput.capturePhoto(
      { location: location.currentLocation },   // settings
      {},                                        // callbacks
    )
    console.log(`Captured ${photo.width}x${photo.height} ${photo.containerFormat} Photo`)
    navigation.navigate('Photo', { photo })     // ← 传 Photo HybridObject
  } catch (e) {
    console.error('Failed to take Photo!', e)
  }
}, [navigation, photoOutput, location.currentLocation])
```

来源：`/tmp/vc-research/apps/simple-camera/src/screens/PhotoScreen.tsx`（行 25-37）

```tsx
import { type Image, NitroImage } from 'react-native-nitro-image'
import type { Photo } from 'react-native-vision-camera'

useEffect(() => {
  const load = async () => {
    const i = await photo.toImageAsync()
    setImage(i)
    photo.dispose()                              // ← 用完必须 dispose
  }
  load()
}, [photo])

return image != null
  ? <NitroImage style={styles.image} resizeMode="contain" image={image} />
  : <ActivityIndicator size="small" color="white" />
```

⚠️ **关键模式：5.x 中显示拍摄结果不再用 `<Image source={{ uri: 'file://...' }} />`**，而是把 `Photo` → `Image` （nitro-image）→ `<NitroImage />`。如果要走 `Image` 标签，需要 `await photo.saveToTemporaryFileAsync()` 拿路径，并自行前缀 `file://`。

### 8.4 录像关键代码片段（同文件，行 176-219）

```tsx
const preparedRecorder = useRef<Recorder>(undefined)
const activeRecorder = useRef<Recorder>(undefined)

const startRecording = useCallback(async () => {
  let recorder = preparedRecorder.current
  if (recorder == null) recorder = await videoOutput.createRecorder({})
  if (activeRecorder.current != null) return  // 已经在录
  activeRecorder.current = recorder
  await recorder.startRecording(
    (path) => {
      navigation.navigate('Video', { videoURL: path })
      activeRecorder.current = undefined
    },
    (error) => { activeRecorder.current = undefined },
    () => console.log('paused'),
    () => console.log('resumed'),
  )
  // 准备下一次：
  preparedRecorder.current = await videoOutput.createRecorder({})
}, [navigation.navigate, videoOutput.createRecorder])
```

注意：example 使用**预热模式**——拍完一段立即创建下一个 recorder 备用，因为单 recorder 只能录一次。

### 8.5 镜头切换/zoom 关键模式

example **没有用 Reanimated SharedValue 绑 zoom**——它的实现方式是用 `enableNativeZoomGesture` 让原生层托管手势（见 `apps/simple-camera/src/components/CameraView.tsx`）。

对焦实现（CameraView.tsx 行 33-58）：
```tsx
const camera = useRef<CameraRef>(null)

const onPress = useCallback(async (event: GestureResponderEvent) => {
  if (camera.current == null) throw new Error('Camera ref is not yet ready!')

  const point = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY }
  try {
    await camera.current.focusTo(point, {
      adaptiveness: 'continuous',
      autoResetAfter: 3,
      responsiveness: 'snappy',
    })
  } catch (error) {
    console.error('Failed to focus!', error)
  }
}, [])

return (
  <View onTouchEnd={onPress}>
    <Camera ref={camera} ... onSubjectAreaChanged={() => camera.current?.resetFocus()} />
  </View>
)
```

注意：example 用 `onTouchEnd` 不用 `Gesture.Tap`——这是因为它把 Pinch 交给 native gesture，所以 RN gesture handler 没必要。如果同时要 Pinch 自定义控制 + Tap focus，则需要 `Gesture.Simultaneous(pinchGesture, tapGesture)`。

---

## Plan 需要调整的清单

### 必须修订（plan/spec 错误或会编译失败）

| Plan 位置 | 现状 | 应改为 | 严重程度 |
|---|---|---|---|
| Task 9 Step 1（行 1112-1114） | `physicalDevices: ['ultra-wide-angle-camera', 'wide-angle-camera']` | `physicalDevices: ['ultra-wide-angle', 'wide-angle']` —— 5.x DeviceType 不带 `-camera` 后缀 | **致命**：传错字符串后 hook 内 filter 永不匹配（fallback 到默认 wide-angle），物理镜头编排失效 |
| Task 10 Step 1（行 1213-1280） | `useCameraFormat` import + 使用 | **完全删除**——`useCameraFormat` 在 5.x 不存在。改用 `constraints` prop（如 `[{ photoHDR: false }]`） | **致命**：`useCameraFormat is not exported` 编译失败 |
| Task 10 Step 1（行 1216-1218） | `import { ... type CameraProps } from 'react-native-vision-camera'` | 加 `type CameraRef`（替代 `useRef<VisionCamera>(null)` 的 `VisionCamera` 类型） | **致命**：5.x 没有 `VisionCamera` 类型导出，`useRef<Camera>` 编译失败 |
| Task 10 Step 1（行 1240） | `const cameraRef = useRef<VisionCamera>(null)` | `const cameraRef = useRef<CameraRef>(null)` | **致命**：同上 |
| Task 10 Step 1（行 1255-1258） | `await photoOutput.capturePhoto({ flash: 'off', enableShutterSound: true })` | `await photoOutput.capturePhoto({ flashMode: 'off', enableShutterSound: true }, {})`（参数名是 `flashMode` 不是 `flash`；必须传第二个 callbacks 参数） | **致命**：`flash` 不是合法字段；callbacks 是必填位置参数 |
| Task 10 Step 1（行 1255-1262） | 用 `photo.path`、`photo.width`、`photo.height` | **`Photo` 没有 `path` 属性**——必须 `const filePath = await photo.saveToTemporaryFileAsync()`，或者改用 `photoOutput.capturePhotoToFile({...}, {})` 拿 `{ filePath }`（但拿不到 width/height，需要在传出去之前用 nitro-image 读取，或者用 `capturePhoto` + `saveToTemporaryFileAsync` 组合，并在 dispose 前读 width/height） | **致命**：运行时 `photo.path === undefined` |
| Task 10 Step 1（行 1255-1262） | 直接 `return buildPhotoFile({path: photo.path, ...}, mode)` | 调用前必须 `const filePath = await photo.saveToTemporaryFileAsync(); ... photo.dispose()`，且要 try/finally 保证 dispose | **致命** |
| Task 13 Step 1（行 1797-1822） | `useVideoOutput()` 无参 OK，但 `videoOutput.startRecording({ flash: 'off' })` 完全错 | 改为两阶段：`const recorder = await videoOutput.createRecorder({})` + `await recorder.startRecording((path, reason) => ..., (err) => ..., () => ..., () => ...)`；停止用 `recorder.stopRecording()`；`flash` 不存在，要"补光"用 `controller.setTorchMode('on')` 或 `<Camera torchMode="on">` | **致命**：API 完全不同 |
| Task 13 Step 1（行 1827-1836） | `const v = await videoOutput.stopRecording(); return buildPhotoFile({ path: v.path, width: v.width, height: v.height, duration: v.duration }, 'video', true)` | `stopRecording` 不返回值——结果通过 `onRecordingFinished(filePath, reason)` 回调。width/height/duration 5.x **不会**自动返回（需要 recorder.recordedDuration 或后续用 ffprobe 解析） | **致命** |
| Task 13 Step 1（行 1840-1842） | `outputs = currentMode.mode === 'video' ? [videoOutput] : [photoOutput]` | 注意：切换 outputs 会触发 session 重新 configure，必须确保 `isActive` 期间没有 active recording（5.x 切 outputs 会导致正在录的视频中断；用 `enablePersistentRecorder: true` 才能保持） | **重要** |
| Task 15 Step 1（行 2142-2144） | `Reanimated.addWhitelistedNativeProps({ zoom: true }); const ReanimatedCamera = Reanimated.createAnimatedComponent(VisionCamera);` | **完全删除** 这 2 行——`<Camera zoom={zoomShared}>` 已原生支持 SharedValue（`src/hooks/internal/useZoomUpdater.ts`） | **重要**：代码可能 still work（no-op），但是冗余且语义错误 |
| Task 15 Step 1（行 2168, 2182-2184） | `useSharedValue(device.neutralZoom)` + `useAnimatedProps(() => ({ zoom: zoom.value }))` + `<ReanimatedCamera animatedProps={animatedProps}>` | `useSharedValue(1)`（hardcode 1）+ `<Camera zoom={zoom} />`（直接传 SharedValue） | **致命**：`device.neutralZoom` 在 5.x 不存在 ⇒ undefined ⇒ NaN 起手 |
| Task 16 Step 2（行 2321-2324） | `if (!device.supportsFocus) return; ... await cameraRef.current?.focus({ x, y })` | `if (!device.supportsFocusMetering) return; ... await cameraRef.current?.focusTo({ x, y })` | **致命**：`device.supportsFocus` 不是 5.x 字段（正确是 `supportsFocusMetering`）；`camera.focus()` 不是 5.x 方法（正确是 `focusTo`） |
| Task 17 Step 2（行 2480-2484） | 仍用 `useCameraFormat(device, [{ photoAspectRatio }, { photoHdr: false }])` | useCameraFormat 不存在；改为通过 photoOutput 的 `targetResolution` 控制宽高比（如 `CommonResolutions.FHD_4_3`、`CommonResolutions.FHD_16_9`），并把 `{ photoHDR: false }` 放到 `<Camera constraints={[...]} />` 中 | **致命** |
| Task 17 Step 3（行 2528, 2541-2544） | `device.neutralZoom` | 改用 hardcode `1` 或 `device.zoomLensSwitchFactors[0] ?? 1` | **致命** |
| Task 2 Step 1（行 141-152） | peer 缺 `react-native-nitro-image` 和 `react-native-worklets` | 加入 peerDeps：`react-native-nitro-image: "*"`、`react-native-worklets: "*"`（reanimated 4 必需） | **重要** |
| Task 2 Step 2（行 169-178） | example deps 缺 `react-native-nitro-image` 和 `react-native-worklets` | 同上加入 example/package.json | **重要** |

### 强烈建议修订（plan 仍能跑，但不符合 5.x 最佳实践 / 有已知坑）

| Plan 位置 | 现状 | 建议 | 原因 |
|---|---|---|---|
| Task 9 Step 1 | `physicalDevices: ['ultra-wide-angle', 'wide-angle']`（修正后） | 考虑降级为 `physicalDevices: ['wide-angle']` 单镜头 | issue #3773 race condition crash 在多物理镜头上更易触发；性能也更快（docs/performance.mdx） |
| Task 10 Step 2 onShutter | 直接用 `await cameraRef.current?.capture()` | 调用前先 try/await `photoOutput.prepareSettings([{ flashMode }])` 预热 | 提升首张照片速度（5.0.10 新增 prepareSettings；Android 是 no-op） |
| Task 8 Step 1 | `useEffect` 中调 `requestPermission()` | 用 `.catch(() => {})` 吞 reject | issue #3834：Android 多个 permission 并行调时 promise 永挂 |
| Task 11+ 预览 | `<Image source={{uri: file.uri}}>` 用 RN 原生 Image | 改用 `<NitroImage image={await photo.toImageAsync()} />`（来自 react-native-nitro-image） | 5.x example 强推的方式；处理 EXIF/orientation 更精确；与 vision-camera 5.x 体系一致 |
| Task 15 Step 1 | `interpolate(z, [1,10], [device.minZoom, device.maxZoom], CLAMP)` | 不用 `interpolate`，直接 `zoom.value = Math.min(Math.max(zoomOffset.value * e.scale, device.minZoom), device.maxZoom)`（在 worklet 内） | example 应用就这么做的；逻辑更直观 |
| Task 19 Step 2 iOS Info.plist | 已有 `NSCameraUsageDescription`、`NSMicrophoneUsageDescription`、`NSPhotoLibraryAddUsageDescription` | 加 `RCTNewArchEnabled=true` | example 应用启用了 New Arch，并且 nitro 推荐 New Arch |
| Task 19 Step 3 Android | 加 `<uses-feature android:name="android.hardware.camera" android:required="true"/>` | **不需要**（example 没声明） | required=true 会导致 Play Store 上没相机的设备不能装；vision-camera 本身允许 external Camera |

### 新增建议（plan 没考虑的）

1. **加 Task：纳入 `react-native-nitro-image`**（spec 与 plan 都漏了）
   - vision-camera 5.x 的 `Photo.toImage()/toImageAsync()` 返回 `Image` 类型来自 `react-native-nitro-image`
   - 如果消费方要显示拍到的照片用 `<NitroImage>`，否则用 `await photo.saveToTemporaryFileAsync()` 拿路径
   - 需要 `npm install react-native-nitro-image` + iOS `pod install`

2. **加 Task：`react-native-worklets` 依赖**
   - reanimated 4.x peer 强制要求
   - 安装：`npm install react-native-worklets`（无原生代码，纯 worklets runtime）

3. **加 Task：iOS 最低部署版本检查**
   - example app 配 `platform :ios, '15.5'`
   - 消费方 `retail-pecportal` 如低于 15.5 需升

4. **加 Task：`capturePhoto` → `saveToTemporaryFileAsync` → `dispose` 序列封装**
   - 这是 5.x 的关键模式
   - 建议封装为辅助函数：
     ```ts
     async function capturePhotoToFile(
       photoOutput: CameraPhotoOutput,
       settings: CapturePhotoSettings,
     ): Promise<{ path: string; width: number; height: number; orientation: CameraOrientation }> {
       const photo = await photoOutput.capturePhoto(settings, {})
       try {
         const path = await photo.saveToTemporaryFileAsync()
         return { path, width: photo.width, height: photo.height, orientation: photo.orientation }
       } finally {
         photo.dispose()
       }
     }
     ```

5. **加 Task：Recorder 预热（参考 example）**
   - 单 recorder 只能录一次，每次录完要立刻创建下一个备用
   - 建议在 Camera.tsx 维护 `preparedRecorderRef` + `activeRecorderRef`

6. **加 Task：Modal 关闭时显式 dispose 残留 photos**
   - 如果 photos 没传给消费方就关闭 Modal，要遍历 `photos.forEach(p => p.dispose())`（如果 photos 已经是 file path 而非 Photo object 就不需要——但这会改变设计）

7. **修正 spec 第 5 节"数据流"**
   - 第 5 步：`useCameraFormat(...)` 不存在，应换成 `<Camera constraints={[{ photoHDR: false }]} />`
   - 第 8 步：`camera.current.focusTo` 正确；但 `device.neutralZoom` 错误
   - 第 8 步：`videoOutput.startRecording()/stopRecording()` 完全错——需重写为 createRecorder + recorder API

8. **修正 spec 第 4.2 类型定义**
   - `CustomPhotoFile.path` 是合理的"外部 API"字段，但内部实现要负责把 `Photo` → file path
   - 考虑增加 `orientation` 字段（5.x 拍出来的 Photo 都带）

9. **测试期注意 #3897（Android Camera 首次布局错位）**
   - example app 真机/模拟器跑 Android 时如果 Camera 在屏幕顶部不动，先 fast refresh 一次
   - 或在 `<Camera>` 外加一层 `<View style={{flex:1}}>` + `onLayout` 强制 measure

10. **测试期注意 #3773（iOS multi-camera crash）**
    - 修正后 plan 用单 `wide-angle` 后此风险消失
    - 如果未来要回到多镜头，需观察 5.0.11+ 是否修复

---

## 附录 A：参考 URL/文件清单

- 仓库 tag：https://github.com/mrousavy/react-native-vision-camera/tree/v5.0.10
- v5.0.0 release notes：https://api.github.com/repos/mrousavy/react-native-vision-camera/releases/tags/v5.0.0
- Issue #3897（Android layout）：https://github.com/mrousavy/react-native-vision-camera/issues/3897
- Issue #3773（iOS race）：https://github.com/mrousavy/react-native-vision-camera/issues/3773
- Issue #3845（neutralZoom missing）：https://github.com/mrousavy/react-native-vision-camera/issues/3845
- Issue #3834（permission leak）：https://github.com/mrousavy/react-native-vision-camera/issues/3834
- Issue #3912（recorder filename）：https://github.com/mrousavy/react-native-vision-camera/issues/3912
- Docs index：`/tmp/vc-research/docs/content/docs/index.mdx`
- Docs constraints：`/tmp/vc-research/docs/content/docs/constraints.mdx`
- Docs camera-view：`/tmp/vc-research/docs/content/docs/camera-view.mdx`
- Docs zooming：`/tmp/vc-research/docs/content/docs/zooming.mdx`
- Docs tap-to-focus：`/tmp/vc-research/docs/content/docs/tap-to-focus.mdx`
- Docs lifecycle：`/tmp/vc-research/docs/content/docs/lifecycle.mdx`
- Docs performance：`/tmp/vc-research/docs/content/docs/performance.mdx`
- Source CameraDevice nitro spec：`/tmp/vc-research/packages/react-native-vision-camera/src/specs/inputs/CameraDevice.nitro.ts`
- Source CameraController nitro spec：`/tmp/vc-research/packages/react-native-vision-camera/src/specs/CameraController.nitro.ts`
- Source Photo nitro spec：`/tmp/vc-research/packages/react-native-vision-camera/src/specs/instances/Photo.nitro.ts`
- Source Recorder nitro spec：`/tmp/vc-research/packages/react-native-vision-camera/src/specs/outputs/Recorder.nitro.ts`
- Source Camera view：`/tmp/vc-research/packages/react-native-vision-camera/src/views/Camera.tsx`
- Source useCamera hook：`/tmp/vc-research/packages/react-native-vision-camera/src/hooks/useCamera.ts`
- Example app CameraScreen：`/tmp/vc-research/apps/simple-camera/src/screens/CameraScreen.tsx`
- Example app PhotoScreen：`/tmp/vc-research/apps/simple-camera/src/screens/PhotoScreen.tsx`
- Example app CameraView：`/tmp/vc-research/apps/simple-camera/src/components/CameraView.tsx`
- Reanimated 4 ConfigHelper.ts (addWhitelistedNativeProps no-op 证据)：https://raw.githubusercontent.com/software-mansion/react-native-reanimated/4.3.1/packages/react-native-reanimated/src/ConfigHelper.ts
- Reanimated 4 package.json：https://raw.githubusercontent.com/software-mansion/react-native-reanimated/4.3.1/packages/react-native-reanimated/package.json
- npm view vision-camera：`npm view react-native-vision-camera time --json`
- npm view nitro-modules：`npm view react-native-nitro-modules version`

---

报告结束。
