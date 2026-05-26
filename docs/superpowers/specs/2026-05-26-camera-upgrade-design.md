# @unif/react-native-camera 2.0.0 升级改造设计

- 日期：2026-05-26
- 仓库：unif-design/react-native-camera（当前空仓，origin 已配置）
- 参考来源：`tongyizixun/unif-react-native-camera` v1.2.5（本地副本：`~/Downloads/react-native-camera-main/`）
- 消费方：`retail-pecportal/src/pages/camera/NewCamera.tsx`
- 设计协作记录：会话日期 2026-05-26
- **API 权威来源**：`docs/superpowers/research/2026-05-26-vision-camera-5x-deep-dive.md`（vision-camera 5.0.10 源码 + 文档逐字核对，本 spec 所有 5.x API 写法以该报告为准）

---

## 1. 背景与目标

### 1.1 现状

- npm 上已发布 `@unif/react-native-camera@1.2.6`（2025-02），基于 RN 0.74.6 + react-native-vision-camera 4.7.3 + Yarn 3.6.1 + bob 0.20
- 原 GitHub 仓库 `tongyizixun/unif-react-native-camera`（私有，本次未访问），本地副本在 `~/Downloads/react-native-camera-main/` 为 v1.2.5
- 当前仓库 `unif-design/react-native-camera` 是组织迁移后的新空仓，已用 `create-react-native-library@0.62.0` 的 `library` 模板初始化（RN 0.85.0 + Yarn 4.11 + bob 0.41）
- 消费方 `retail-pecportal/NewCamera.tsx` 使用 `useCamera()` hook 打开相机，配置 `cameraMode` / `dataRetainedMode` / `watermark` / `photoResolution`

### 1.2 目标

- 用 `create-react-native-library` 最新默认模板搭建项目（已完成）
- 内部完全按 react-native-vision-camera 5.x 最佳实践重写
- 保持公开 hook 名与基本签名，参数做最小幅度调整（去掉 `photoResolution/videoResolution/watermark`，新增 `photoQuality/jpegQuality`）
- 启用 RN New Architecture
- 顶层导出全部 TypeScript public types（消除 deep import）
- 新增"点击对焦"能力（原仓库无）
- 把原"鱼眼"按钮重构为"镜头切换"能力（基于 vision-camera 物理镜头编排）
- 清理冗余代码（示例性原生方法、TurboModule spec 等）
- 水印 (watermark) 暂不实现，预留至 v2.1.x

### 1.3 非目标

- 不引入新的拍摄能力（HDR / RAW / 帧处理 / 二维码扫描等），保持范围聚焦
- 不重新设计 UI（保留原有视觉风格与图标资源）
- 不做 web 平台支持

---

## 2. 架构与技术栈

### 2.1 脚手架

| 项 | 值 |
|---|---|
| CLI | `npx create-react-native-library@latest unif-react-native-camera` |
| 类型 | `library`（纯 TypeScript / 无自定义原生代码） |
| 语言 | TypeScript |
| 示例应用 | Community CLI |
| 工具集 | ESLint+Prettier、Jest、Lefthook+Commitlint、Release It（**取消 Vite**，库不支持 web） |
| 包管理 | Yarn 4.11（脚手架默认） |
| 构建 | react-native-builder-bob 0.41（输出 esm + typescript） |

### 2.2 package.json 关键字段

```json
{
  "name": "@unif/react-native-camera",
  "version": "2.0.0",
  "description": "基于 react-native-vision-camera 的相机库（单拍/连拍/视频+预览）",
  "repository": { "url": "git+https://github.com/unif-design/react-native-camera.git" },
  "bugs": { "url": "https://github.com/unif-design/react-native-camera/issues" },
  "homepage": "https://github.com/unif-design/react-native-camera#readme"
}
```

### 2.3 peer dependencies

| 依赖 | 版本约束 | 用途 |
|---|---|---|
| react | `>=19.0.0` | 跟随 RN 0.85+ |
| react-native | `>=0.85.0` | 脚手架默认目标 |
| react-native-vision-camera | `^5.0.0` | 核心相机能力（Nitro Modules） |
| react-native-nitro-modules | `*` | vision-camera 5.x 的 Nitro 运行时底座 |
| react-native-nitro-image | `*` | **vision-camera 5.x peer（必装）**：`Photo.toImage()` / `<NitroImage>` 渲染拍摄结果 |
| react-native-reanimated | `>=4.0.0` | zoom SharedValue 直接传给 `<Camera zoom>`（5.x 原生支持） |
| react-native-worklets | `*` | **reanimated 4 peer（必装）**：reanimated 4 不再自带 worklets runtime，需单独安装 |
| react-native-reanimated-carousel | `>=4.0.0` | 预览轮播 |
| react-native-gesture-handler | `>=2.21.0` | 捏合变焦 + 点击对焦手势 |
| react-native-safe-area-context | `>=5.0.0` | 替代旧仓库的自定义 `getSafeAreaInsets()` 原生方法 |
| react-native-webview | `*` | 保留原有依赖 |

> 实际版本号执行时通过 `npm view <pkg> version` 取最新 stable。截至 2026-05-26：
> - `react-native-vision-camera@5.0.10`
> - `react-native-nitro-modules@0.35.7`、`react-native-nitro-image@0.14.0`
> - `react-native-reanimated@4.3.1`、`react-native-worklets@0.8.3`

**移除依赖**：`react-native-view-shot`、`react-native-canvas`（仅用于水印，v2.0.0 不含水印）。v2.1.x 重新加入水印时再恢复。

### 2.4 脚手架后清理项

| 路径 | 处理 |
|---|---|
| `src/multiply.tsx` | 删除（脚手架默认示例） |
| `src/index.tsx` | 重写为 `useCamera` + 全部 public types 导出 |
| `example/src/App.tsx` | 重写为相机演示页（3 个按钮：单拍 / 连拍 / 视频） |
| `src/NativeReactNativeCamera.ts` | 不创建（library 类型无 codegen 需求） |
| 原仓库 `cpp/ios/android/UnifRNCamera.podspec` | 不迁移（library 模板无原生壳） |

---

## 3. src/ 组件结构

```
src/
├── index.tsx                          # 包入口：导出 useCamera + 全部 public types
├── hooks/
│   ├── index.ts                       # 桶导出
│   ├── useCamera.tsx                  # 主 hook：open()/close()、Modal 显隐、Promise 编排
│   ├── useConfirm.tsx                 # 确认对话框 hook（关闭确认）
│   └── useCreation.ts                 # 仅声明一次的 ref（保留）
├── camera/
│   ├── index.tsx                      # 桶导出
│   ├── ModalView.tsx                  # Modal 包装层
│   ├── Container.tsx                  # 编排：device / format / output / 当前 mode
│   ├── Camera.tsx                     # <Camera> + GestureDetector + zoom SharedValue（5.x 原生支持）
│   ├── capturePhotoHelper.ts          # capturePhoto → saveToTemporaryFileAsync → dispose 序列封装
│   ├── FocusIndicator.tsx             # 点击对焦圈动画
│   ├── NoCamera.tsx                   # 设备不可用提示
│   ├── NoPermission.tsx               # 权限被拒提示
│   ├── Error.tsx                      # 通用错误页
│   ├── footer/
│   │   ├── index.tsx
│   │   └── Footer.tsx                 # 快门 / 模式选择 / 缩略图
│   ├── setup/
│   │   ├── index.tsx
│   │   └── SetUp.tsx                  # 闪光灯 / 宽高比 / 镜头切换（原"鱼眼"）
│   └── preview/
│       ├── index.tsx
│       ├── PreView.tsx                # 多照片轮播预览
│       ├── SinglePre.tsx              # 单照片预览
│       ├── PreViewContainer.tsx       # 预览包装
│       └── PreviewFooter.tsx          # 预览底部操作（确认 / 删除 / 旋转 / 重拍）
├── components/                        # 通用 UI
│   ├── index.tsx
│   ├── Back.tsx
│   ├── Delete.tsx
│   ├── Rotate.tsx
│   ├── Save.tsx
│   ├── PreviewThumbnail.tsx
│   ├── Loading.tsx
│   ├── Modal/
│   │   ├── index.tsx
│   │   └── Confirm.tsx
│   └── Carousel/
│       ├── index.tsx
│       ├── Carousel.tsx
│       └── SlideItem.tsx
└── utils/
    ├── index.ts                       # 桶导出（re-export 全部 public types）
    ├── interface.ts                   # TypeScript 类型定义
    ├── common.ts                      # 通用工具
    ├── px-to-dp.tsx                   # 设计稿适配
    ├── render-item.tsx                # 轮播渲染项
    ├── depsAreSame.ts                 # 浅比较
    └── util.ts                        # 杂项
```

### 3.1 与原仓库的差异

| 变更 | 说明 |
|---|---|
| 移除 `src/camera/watermark/` | 水印模块整体推迟到 v2.1.x |
| 移除 `src/utils/watermark.ts` | 同上 |
| 移除 `src/NativeReactNativeCamera.ts` | library 模板无需 TurboModule spec |
| 新增 `FocusIndicator` 集成 | 点击对焦能力首次落地 |
| `setup/SetUp.tsx` 重构 | "鱼眼按钮"重新定位为镜头切换（`minZoom` ↔ `1`；5.x 已无 `device.neutralZoom`，用 hardcode `1` 代表"自然 1x"） |
| `Camera.tsx` 重写 | 完全基于 vision-camera 5.x outputs API |
| `src/index.tsx` 顶层导出全部类型 | 消除原 deep import 路径 |

---

## 4. 公开 API（v2.0.0）

### 4.1 入口与签名

```ts
import { useCamera } from '@unif/react-native-camera';
import type {
  CameraMode,
  PhotoQuality,
  DataRetainedMode,
  CustomPhotoFile,
  CameraResult,
  CameraApi,
  Point,
} from '@unif/react-native-camera';

function App() {
  const [api, holder] = useCamera();
  // ...
  return holder;
}
```

> 内部实现需要从 `react-native-vision-camera` 顶层导入（不在本库 public API 内，但写代码时需要类型）：
> ```ts
> import type {
>   CameraRef,          // useRef<CameraRef>(null)
>   CameraDevice,
>   CameraProps,
>   FocusOptions,
>   CapturePhotoSettings,
>   CapturePhotoCallbacks,
>   CameraPhotoOutput,
>   CameraVideoOutput,
>   Recorder,
>   Photo,
>   PhotoFile,
>   CameraOrientation,
>   Constraint,
> } from 'react-native-vision-camera';
> ```

### 4.2 类型定义（`src/utils/interface.ts`）

```ts
export type CameraType = 'back' | 'front';

export type PhotoQuality = 'speed' | 'balanced' | 'quality';

export type DataRetainedMode = 'clear' | 'retain';

export type CameraModeName = 'single' | 'continuous' | 'video';

export type CameraMode = {
  mode: CameraModeName;
  /** 相机管线模式，默认 'speed'（启用零快门延迟） */
  photoQuality?: PhotoQuality;
  /** JPEG 压缩率，0.0~1.0，默认 0.9（小文件目标） */
  jpegQuality?: number;
};

export type OpenConfig = {
  cameraMode: CameraMode[];
  dataRetainedMode: DataRetainedMode;
};

export type CustomPhotoFile = {
  path: string;                // 文件绝对路径
  uri: string;                 // file:// scheme
  width: number;
  height: number;
  mime: 'image/jpeg' | 'video/mp4';
  mode: CameraModeName;
  duration?: number;           // video 才有
};

export type CameraResult = {
  code: 0 | 200 | 403 | 404 | 500 | 503;
  data: CustomPhotoFile[];
  message: string;
};

export type CameraApi = {
  open: (config: OpenConfig) => Promise<CameraResult>;
  close: () => void;
};

export type Point = { x: number; y: number };
```

### 4.3 与 v1.x 的差异

| 字段 | v1.x | v2.0.0 |
|---|---|---|
| `cameraMode[i].photoResolution` | `{ width, height }` | **删除** |
| `cameraMode[i].videoResolution` | `{ width, height }` | **删除** |
| `cameraMode[i].photoQuality` | — | **新增**，默认 `'speed'` |
| `cameraMode[i].jpegQuality` | — | **新增**，默认 `0.9` |
| `OpenConfig.watermark` | `WatermarkType` | **删除**（推迟到 v2.1.x） |
| `CustomPhotoFile.watermark` | `boolean` | **删除** |

### 4.4 消费方 (retail-pecportal) PR 改动

`src/pages/camera/NewCamera.tsx` 需同步改动（约 5 行）：

```diff
- import { CameraModeType } from '@unif/react-native-camera/lib/typescript/src/utils';
+ import type { CameraMode } from '@unif/react-native-camera';

  const res = await api.open({
    cameraMode: global.newCameraData.cameraMode.map((item) => ({
-     photoResolution: {width: 1500, height: 750},
-     videoResolution: {width: 1500, height: 750},
+     photoQuality: 'speed' as const,
+     jpegQuality: 0.9,
      ...item,
-   })) as CameraModeType[],
+   })) as CameraMode[],
    dataRetainedMode: global.newCameraData.dataRetainedMode,
-   watermark: global?.newCameraData?.watermark,
  });
```

---

## 5. 数据流与生命周期

```
1. 消费方调用 api.open(config)
   └─ useCamera 内部 ref 存 config，setVisible(true)
   └─ 返回 Promise<CameraResult>（pending）

2. <ModalView visible> 挂载

3. useCameraPermission() → 检查权限
   ├─ 未授权 → requestPermission().catch(() => {})   // catch 兜底防 Android #3834 leak
   ├─ 拒绝 → 显示 <NoPermission/> + resolve({ code: 403, data: [], message: 'permission_denied' })
   └─ 同意 → 继续

4. useCameraDevice('back', { physicalDevices: ['wide-angle'] })
   ├─ 注意 1：5.x 类型字符串不带 `-camera` 后缀（合法值仅 'wide-angle' / 'ultra-wide-angle' / 'telephoto'）
   ├─ 注意 2：单 wide-angle 启动以规避 iOS multi-camera race crash #3773
   └─ device == null → <NoCamera/> + resolve({ code: 404, data: [], message: 'no_device' })

5. usePhotoOutput({
      qualityPrioritization: 当前 mode 的 photoQuality,
      quality: 当前 mode 的 jpegQuality,
      targetResolution: { width: 1080, height: 1440 } // 4:3 时；16:9 时换 1080x1920
   }) → photoOutput

   useVideoOutput()（仅当 cameraMode 包含 'video'）

   useMicrophonePermission()（仅当 cameraMode 包含 'video'）

   注意：5.x 已无 useCameraFormat hook。宽高比通过 photoOutput 的 targetResolution 控制；
   其它软约束（如关 HDR）通过 <Camera constraints={[{ photoHDR: false }]} /> 传入。

6. <Camera
      ref={camera}                                      // useRef<CameraRef>(null)
      style={StyleSheet.absoluteFill}                   // 防 Android #3897 layout 错位
      device={device}
      isActive={true}
      outputs={[photoOutput, /* videoOutput when video mode */]}
      constraints={[{ photoHDR: false }]}
      zoom={zoomShared}                                 // SharedValue<number> 原生支持，无需 createAnimatedComponent
      torchMode={flash === 'on' ? 'on' : 'off'}         // 视频补光走 torch
   />
   ▾ 包裹在 <GestureDetector gesture={Simultaneous(pinchGesture, tapGesture)} />

7. 用户交互：
   - 捏合 → pinchGesture 在 worklet 内更新 zoomShared.value（clamp 到 device.minZoom/maxZoom）
   - 点击预览区 → tapGesture → camera.current.focusTo({x,y}, options) + 显示 <FocusIndicator/>
   - 切换 setup 镜头按钮 → zoom.value = device.minZoom 或 1（hardcode；5.x 无 device.neutralZoom）
   - 按快门：
     * single → photoOutput.capturePhoto({ flashMode, enableShutterSound }, {}) 返回 Photo HybridObject
                → photo.saveToTemporaryFileAsync() 拿文件路径
                → 读取 photo.width/height/orientation
                → photo.dispose() 释放内存
                → buildPhotoFile → CustomPhotoFile
     * continuous → 连续 capturePhoto → CustomPhotoFile[] 入栈
     * video → const recorder = await videoOutput.createRecorder({})
              await recorder.startRecording(onFinished, onError, onPaused, onResumed)
              停止：await recorder.stopRecording()（不返回值；路径由 onFinished 回调送出）
              单 recorder 只能录一次，下一段需重新 createRecorder
   - 切换 cameraMode（在多模式配置时）→ 重建 photoOutput 用新 photoQuality/jpegQuality

8. 完成拍摄 → 进入 Preview（轮播或单图）

9. 用户确认 → resolve({ code: 200, data: CustomPhotoFile[], message: 'ok' })
   用户取消 → resolve({ code: 0, data: [], message: 'cancelled' })

10. Modal 关闭，holder 卸载，photoOutput / recorder 自动销毁
    （注意：未 dispose 的 Photo HybridObject 必须显式 photo.dispose()，否则内存泄漏）
```

---

## 6. 关键实现要点

### 6.1 Camera 组件包装（5.x：无需 createAnimatedComponent）

```tsx
// src/camera/Camera.tsx 关键骨架
import { useSharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  Camera,
  type CameraRef,
  type CameraDevice,
  type FocusOptions,
  type Point,
} from 'react-native-vision-camera';

// 5.x 注意：
//   - <Camera> 已原生支持 zoom={SharedValue<number>}，**不再需要** Reanimated.createAnimatedComponent
//   - Reanimated 4 的 addWhitelistedNativeProps 是 no-op，**不要调用**
//   - useAnimatedProps + animatedProps={{zoom}} 写法已过时
//   - Camera ref 类型是 CameraRef（interface），不是 VisionCamera（class）
```

### 6.2 Zoom（替代原"鱼眼"按钮组）

```tsx
const device = useCameraDevice('back', {
  physicalDevices: ['wide-angle'], // 5.x 不带 -camera 后缀；单镜头规避 #3773 crash
});

// 5.x 没有 device.neutralZoom；用 hardcode 1 作"自然 1x"
const NEUTRAL_ZOOM = 1;

const zoom = useSharedValue(NEUTRAL_ZOOM);
const zoomOffset = useSharedValue(0);

const pinchGesture = Gesture.Pinch()
  .onBegin(() => {
    'worklet';
    zoomOffset.value = zoom.value;
  })
  .onUpdate((e) => {
    'worklet';
    const z = zoomOffset.value * e.scale;
    // 直接 clamp 到 device.minZoom..maxZoom；example 应用就这么做（更直观，不用 interpolate）
    zoom.value = Math.min(Math.max(z, device.minZoom), device.maxZoom);
  });

// 镜头切换按钮
const onToggleLens = () => {
  zoom.value = zoom.value === device.minZoom ? NEUTRAL_ZOOM : device.minZoom;
};

// 渲染：直接把 SharedValue 传给 <Camera zoom={zoom} />，原生 controller 接管
<Camera
  ref={cameraRef}
  device={device}
  isActive
  outputs={[photoOutput]}
  zoom={zoom}
/>
```

### 6.3 Tap-to-Focus（新增能力）

```tsx
import { runOnJS } from 'react-native-reanimated';
import { type CameraRef, type FocusOptions } from 'react-native-vision-camera';

const cameraRef = useRef<CameraRef>(null);   // 5.x 是 CameraRef 不是 VisionCamera
const [focusPoint, setFocusPoint] = useState<Point | null>(null);

const handleFocus = useCallback(async (x: number, y: number) => {
  // 5.x 字段名是 supportsFocusMetering，不是 supportsFocus
  if (!device?.supportsFocusMetering) return;
  setFocusPoint({ x, y });
  try {
    // 5.x 方法名是 focusTo（自动做 view→camera 坐标转换），不是 focus
    await cameraRef.current?.focusTo(
      { x, y },
      {
        responsiveness: 'snappy',       // 默认
        adaptiveness: 'continuous',     // 默认
        autoResetAfter: 3,              // 3 秒后自动 resetFocus
      } satisfies FocusOptions,
    );
  } catch {}
}, [device]);

const tapGesture = Gesture.Tap()
  .onEnd(({ x, y }) => {
    runOnJS(handleFocus)(x, y);
  });

return (
  <GestureDetector gesture={Gesture.Simultaneous(pinchGesture, tapGesture)}>
    <View style={StyleSheet.absoluteFill}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        outputs={[photoOutput]}
        zoom={zoom}
        constraints={[{ photoHDR: false }]}
        onSubjectAreaChanged={() => cameraRef.current?.resetFocus()}
      />
      {focusPoint && (
        <FocusIndicator
          point={focusPoint}
          onAnimationEnd={() => setFocusPoint(null)}
        />
      )}
    </View>
  </GestureDetector>
);
```

### 6.4 photoOutput 重建策略

`usePhotoOutput` 配置变化时（切换 mode 导致 `photoQuality`/`jpegQuality` 变化）：

```ts
const currentMode = cameraMode[currentIndex];
const photoOutput = usePhotoOutput({
  qualityPrioritization: currentMode.photoQuality ?? 'speed',
  quality: currentMode.jpegQuality ?? 0.9,
});
// 依赖 currentIndex 变化时 hook 自然重建
```

### 6.5 capturePhoto 调用（5.x：两参数 + saveToTemporaryFileAsync + dispose）

```ts
// 推荐封装到 src/camera/capturePhotoHelper.ts
import type {
  CameraPhotoOutput,
  CapturePhotoSettings,
  CameraOrientation,
} from 'react-native-vision-camera';

export async function capturePhotoToFile(
  photoOutput: CameraPhotoOutput,
  settings: CapturePhotoSettings,
): Promise<{ path: string; width: number; height: number; orientation: CameraOrientation }> {
  // 5.x 关键变化：
  //   - capturePhoto(settings, callbacks) 两个参数都必填；callbacks 可空对象 {}
  //   - settings 字段名是 flashMode（不是 flash）
  //   - 返回 Photo HybridObject，**没有 .path 属性**
  //   - 要拿路径必须 await photo.saveToTemporaryFileAsync()
  //   - 该路径**不带 file:// 前缀**，外层用时自行拼
  //   - 拿完数据必须 photo.dispose() 释放内存
  const photo = await photoOutput.capturePhoto(settings, {});
  try {
    const path = await photo.saveToTemporaryFileAsync();
    return {
      path,
      width: photo.width,
      height: photo.height,
      orientation: photo.orientation,
    };
  } finally {
    photo.dispose();
  }
}

// 调用方：
const raw = await capturePhotoToFile(photoOutput, {
  flashMode,                   // 'on' | 'off' | 'auto'，5.x 字段名
  enableShutterSound: true,
});

const file: CustomPhotoFile = buildPhotoFile(
  { path: raw.path, width: raw.width, height: raw.height },
  currentMode.mode,
);
// buildPhotoFile 内部把裸 path 拼成 file://path 写到 uri 字段
```

### 6.6 视频录制（5.x：两阶段 createRecorder + startRecording 回调）

```ts
import type { CameraVideoOutput, Recorder } from 'react-native-vision-camera';

// Container 维护 ref 防止并发
const activeRecorderRef = useRef<Recorder | null>(null);
const preparedRecorderRef = useRef<Recorder | null>(null);

const startVideo = useCallback(async () => {
  // 单 recorder 只能录一次；从 prepared 池里拿，没有就 createRecorder
  let recorder = preparedRecorderRef.current;
  if (recorder == null) {
    recorder = await videoOutput.createRecorder({});
  }
  preparedRecorderRef.current = null;
  if (activeRecorderRef.current != null) return; // 已经在录
  activeRecorderRef.current = recorder;

  // 5.x 关键：startRecording 接 4 个 callback（不是 options object）
  //   - 无 flash 字段；视频补光通过 <Camera torchMode="on"> 控制
  //   - stopRecording 不返回结果，结果通过 onFinished(filePath, reason) 回调
  await recorder.startRecording(
    (filePath, reason) => {
      // filePath 不带 file:// 前缀；reason: 'stopped' | 'max-duration-reached' | 'max-file-size-reached'
      const file = buildPhotoFile({ path: filePath, width: 0, height: 0 }, 'video', true);
      onVideoFinished(file);
      activeRecorderRef.current = null;
    },
    (error) => {
      activeRecorderRef.current = null;
      onVideoError(error);
    },
    () => { /* paused */ },
    () => { /* resumed */ },
  );

  // 立即创建下一个 recorder 备用（example 应用的预热模式）
  preparedRecorderRef.current = await videoOutput.createRecorder({});
}, [videoOutput, onVideoFinished, onVideoError]);

const stopVideo = useCallback(async () => {
  // 5.x：stopRecording 没有返回值；文件路径由上面的 onFinished 回调送出
  await activeRecorderRef.current?.stopRecording();
}, []);
```

> ⚠️ 5.x 录像 API 与 4.x **完全不同**：4.x 是 `videoOutput.startRecording({onRecordingFinished, onRecordingError, flash})` + `stopRecording()`；5.x 必须先 `createRecorder()` 拿到 `Recorder` 实例，再 `recorder.startRecording(...)`，且 callback 是位置参数。

### 6.7 拍摄结果显示（推荐 NitroImage，可选 file:// + RN Image）

```tsx
// 方案 A（推荐，与 vision-camera 5.x 体系一致）：
import { NitroImage, type Image } from 'react-native-nitro-image';
import type { Photo } from 'react-native-vision-camera';

// 在 capturePhoto 后不立即 saveToTemporaryFileAsync，而是把 Photo 直接交给预览：
const photo = await photoOutput.capturePhoto(settings, {});
const image = await photo.toImageAsync();
// 用完同样要 photo.dispose() 或在 unmount 时 dispose
<NitroImage style={...} resizeMode="contain" image={image} />

// 方案 B（保留 RN 原生 <Image>）：
// 必须 await photo.saveToTemporaryFileAsync() 拿路径，再拼 file://
<Image source={{ uri: `file://${path}` }} />
```

本仓库 v2.0.0 采用**方案 B**（保留 file:// 路径返回给消费方，消费方业务多用 `cacheCopyfiles` 接路径而非 `Image` 对象）。`<SinglePre>` / `<SlideItem>` 内部仍用 RN 原生 `<Image>` 渲染。

---

## 7. 错误处理

| 场景 | code | data | message |
|---|---|---|---|
| 正常完成 | 200 | `CustomPhotoFile[]` | `'ok'` |
| 用户取消（返回键 / X） | 0 | `[]` | `'cancelled'` |
| 相机权限永久拒绝 | 403 | `[]` | `'permission_denied'` |
| 无可用相机设备 | 404 | `[]` | `'no_device'` |
| 拍照失败（capturePhoto 抛错） | 500 | 已成功拍摄的 | `'capture_failed: <reason>'` |
| 视频录制失败 | 503 | `[]` | `'video_failed: <reason>'` |

**异常处理原则**：

- 所有 vision-camera 调用（`capturePhoto` / `startRecording` / `stopRecording` / `focusTo`）必须 try/catch
- `focusTo` 失败时不抛给用户（仅吞掉），用户感知就是"对焦圈出现但相机没动"
- Modal 卸载时如 Promise 未 settle，统一 resolve `{ code: 0, data: [], message: 'cancelled' }`
- 同一次 `open()` 重复调用幂等：返回同一 Promise

---

## 8. 测试与验证

### 8.1 单元测试（Jest）

`src/__tests__/index.test.tsx`（替换脚手架的 multiply 测试）：

- `useCamera` 渲染 holder 不报错
- 公开 API 形状符合 TypeScript（用 `@ts-expect-error` 反向验证：传错类型应报错）
- 关闭对话框确认逻辑

vision-camera / reanimated / gesture-handler 在 jest 环境通过 `@react-native/jest-preset` 提供的 mock 处理，不另写 mock。

### 8.2 Example 应用集成验证

`example/src/App.tsx` 重写：

- 顶部展示上一次返回数据（JSON 预览）
- 3 个按钮：单拍 / 连拍 / 视频
- 每个按钮对应不同的 `cameraMode` 配置

`example/ios/.../Info.plist` 添加：

```xml
<key>NSCameraUsageDescription</key>
<string>App 需要访问相机以拍照</string>
<key>NSMicrophoneUsageDescription</key>
<string>App 需要访问麦克风以录制视频</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>保存照片到相册</string>
<!-- 启用 New Architecture（vision-camera 5.x Nitro Modules 推荐路径） -->
<key>RCTNewArchEnabled</key>
<true/>
```

iOS Podfile 必须 `platform :ios, '15.5'`（vision-camera 5.x 最低部署版本）。

`example/android/app/src/main/AndroidManifest.xml` 添加：

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```

> 注意：不建议加 `<uses-feature android:name="android.hardware.camera" android:required="true"/>`。required=true 会导致 Play Store 上没相机的设备不能装；vision-camera 也允许外接相机。example 应用未声明。

Android minSdk 必须 23+（vision-camera 5.x 最低要求）。

验证流程（真机）：

| 场景 | 预期 |
|---|---|
| 首次启动 → 点单拍 | 弹权限请求 → 同意 → 进入相机 → 拍照 → 预览 → 确认返回 |
| 点连拍 | 进入相机 → 连续拍照 3 张 → 预览轮播 → 确认返回 |
| 点视频 | 弹麦克风权限 → 进入相机 → 录制 5s → 停止 → 返回 |
| 捏合 | 实时缩放，达 minZoom/maxZoom 边界停止 |
| 镜头切换 | 0.5x ↔ 1x（设备支持时） |
| 点击预览区任意点 | 对焦圈出现 800ms 后消失，相机重新对焦 |
| 拒绝权限再次打开 | 显示 NoPermission 页 + resolve 403 |

### 8.3 消费方对照验证

`retail-pecportal/src/pages/camera/NewCamera.tsx` 按 4.4 节改动 3 处：

- `photoResolution` / `videoResolution` 字段 → 替换为 `photoQuality` / `jpegQuality`
- `watermark` 字段 → 删除
- import 类型路径 → 改顶层导入

跑业务最常用的"扫描产品 → 拍照上传"路径，确认：

- `res.code === 200` 时 `res.data[i].path` 可读、`uri` 可被 `cacheCopyfiles` 处理
- 输出数据形状除 `watermark` 字段外与 v1.x 一致

---

## 9. 发布与版本号

- 版本：`2.0.0`（major bump 原因：移除 `watermark` / `photoResolution` 字段，公开 API 有 breaking change）
- 发布命令：`yarn release`（脚手架已配置 release-it + conventional-changelog）
- npm tag：`latest`
- CHANGELOG 由 conventional-changelog 自动生成

---

## 10. 范围外 / 未来工作（v2.1.x+）

### 10.1 watermark 回归

下次重启水印能力时：

- 在 `src/camera/watermark/` 创建：
  - `Render.tsx`（水印 React 渲染）
  - `ViewShotWatermark.tsx`（react-native-view-shot 合成）
- 在 `src/utils/watermark.ts` 实现水印数据归一化
- peer dependencies 重新加入：
  - `react-native-view-shot ^4.0.3`
  - `react-native-canvas *`
- `OpenConfig` 新增 `watermark?: WatermarkConfig`
- `CustomPhotoFile` 新增 `watermark?: boolean`
- 数据流增加"水印合成"步骤（在 capturePhoto 之后、resolve 之前）
- 错误码新增 `502 watermark_failed`

### 10.2 其他可能的方向（暂不规划）

- HDR 拍照 / RAW 输出
- 帧处理器 (Frame Processor)：二维码扫描 / 人脸检测 / 文档矫正
- 多镜头同时取景（vision-camera 5.x 已支持 `useCameraDevice` 物理镜头编排）
- AI 智能取景（与 lenz_ai_camera 等模块协作）

---

## 11. 风险与缓解

| 风险 | 影响版本 | 缓解 |
|---|---|---|
| vision-camera 5.x 稳定性（较新） | 5.0.x | example 应用真机验证；如阻塞，降级到 4.7.3（保留分支） |
| 消费方 `retail-pecportal` 用了 deep import 类型路径 | — | 提供顶层导出后清晰的迁移 diff，PR 改 3-5 行 |
| RN 0.85 + New Arch + Nitro Modules 在 Android 老机型上性能差 | — | 在 example 应用测试 Android 7/8 老设备；minSdk 23 (Android 6.0)+ |
| Yarn 4 与 corepack 配置不当导致拉取失败 | — | README 注明 `corepack enable` |
| iOS Privacy Manifest（PrivacyInfo.xcprivacy）未覆盖相机访问 | — | 脚手架已生成模板，按 Apple 要求补齐 NSPrivacyAccessedAPI |
| **iOS multi-camera race condition crash（issue #3773）** | 5.0.4+ 未修复 | 单 `physicalDevices: ['wide-angle']` 启动；切镜头改走 zoom |
| **Android Camera 首次布局错位（issue #3897）** | 5.0.9 未修复 | `<Camera style={StyleSheet.absoluteFill}>`；`onPreviewStarted` 触发 forceLayout |
| **Android requestPermission promise 泄漏（issue #3834）** | 5.x | 所有 `requestPermission()` 加 `.catch(() => {})`；以 `hasPermission` 为 source of truth |
| **Android Recorder 生成 mp4 文件名缺扩展名（issue #3912）** | 5.0.1+ | 在 `onFinished` 回调拿到 filePath 后手动 rename 加 `.mp4`，或显式传 `RecorderSettings.filePath` |
| **单 Recorder 只能录一次** | 5.x | 每次 startRecording 后立刻 createRecorder 备用；activeRecorderRef + preparedRecorderRef 维护 |
| **iOS 启动横屏时预览 90° 旋转（PR #3899 review 中）** | 5.0.10 | 升级到 5.0.11+ 时跟进；或锁定竖屏 |
| **Photo HybridObject 内存泄漏** | 5.x 设计 | 严格 try/finally 调 `photo.dispose()`；Modal unmount 前清空残留 |
| **iOS 部署版本 < 15.5** | — | iOS 15.5+（vision-camera 5.x podspec 跟随 RN 0.85 默认） |

---

## 12. 实施顺序（实施计划另行编写）

1. **基础打通**：example 应用空跑能起来（iOS / Android）
2. **基础 API 骨架**：useCamera + Modal + 空白 Camera 页 → resolve `{code: 0}`
3. **设备/约束/权限**：useCameraPermission + useCameraDevice (`{physicalDevices:['wide-angle']}`) + `<Camera constraints={[{photoHDR:false}]}>`
4. **核心拍照**：usePhotoOutput + capturePhoto + single mode
5. **预览页**：拍完后进 SinglePre / PreView 轮播 + 确认返回
6. **连拍 / 视频**：扩展 cameraMode
7. **Zoom**：Reanimated + Gesture.Pinch + 镜头切换按钮
8. **Tap-to-Focus**：Gesture.Tap + focusTo + FocusIndicator
9. **Setup 面板**：闪光灯 / 宽高比 / 镜头切换
10. **错误处理 / code 规范化**
11. **类型导出整理 / 文档**
12. **消费方对照测试 (retail-pecportal)**
13. **发布 2.0.0**
