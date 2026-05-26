# @unif/react-native-camera 2.0.0 升级改造设计

- 日期：2026-05-26
- 仓库：unif-design/react-native-camera（当前空仓，origin 已配置）
- 参考来源：`tongyizixun/unif-react-native-camera` v1.2.5（本地副本：`~/Downloads/react-native-camera-main/`）
- 消费方：`retail-pecportal/src/pages/camera/NewCamera.tsx`
- 设计协作记录：会话日期 2026-05-26

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
| react-native-nitro-modules | `^0.x` | vision-camera 5.x 的新底座 |
| react-native-reanimated | `>=4.0.0` | zoom 共享值 + 动画 |
| react-native-reanimated-carousel | `>=4.0.0` | 预览轮播 |
| react-native-gesture-handler | `>=2.21.0` | 捏合变焦 + 点击对焦手势 |
| react-native-safe-area-context | `>=5.0.0` | 替代旧仓库的自定义 `getSafeAreaInsets()` 原生方法 |
| react-native-webview | `*` | 保留原有依赖 |

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
│   ├── Camera.tsx                     # ReanimatedCamera + GestureDetector + 输出绑定
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
| `setup/SetUp.tsx` 重构 | "鱼眼按钮"重新定位为镜头切换（minZoom ↔ neutralZoom） |
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
   ├─ 未授权 → requestPermission()
   ├─ 拒绝 → 显示 <NoPermission/> + resolve({ code: 403, data: [], message: 'permission_denied' })
   └─ 同意 → 继续

4. useCameraDevice('back', { physicalDevices: ['ultra-wide-angle-camera', 'wide-angle-camera'] })
   └─ device == null → <NoCamera/> + resolve({ code: 404, data: [], message: 'no_device' })

5. useCameraFormat(device, [
      { photoAspectRatio: 当前选择的 4/3 或 16/9 },
      { photoHdr: false }
   ]) → format

6. usePhotoOutput({
      qualityPrioritization: 当前 mode 的 photoQuality,
      quality: 当前 mode 的 jpegQuality,
   }) → photoOutput

   useMicrophonePermission()（仅当 cameraMode 包含 'video'）

7. <ReanimatedCamera
      ref={camera}
      device={device}
      format={format}
      isActive
      outputs={[photoOutput, /* videoOutput when video mode */]}
      animatedProps={{ zoom }}
   />
   ▾ 包裹在 <GestureDetector gesture={Simultaneous(pinchGesture, tapGesture)} />

8. 用户交互：
   - 捏合 → pinchGesture 更新 zoom SharedValue
   - 点击预览区 → tapGesture → camera.current.focusTo({x,y}) + 显示 <FocusIndicator/>
   - 切换 setup 镜头按钮 → zoom.value = device.minZoom 或 device.neutralZoom
   - 按快门：
     * single → photoOutput.capturePhoto({ flash, enableShutterSound }) → CustomPhotoFile
     * continuous → 连续 capturePhoto → CustomPhotoFile[] 入栈
     * video → videoOutput.startRecording() / stopRecording()
   - 切换 cameraMode（在多模式配置时）→ 重建 photoOutput 用新 photoQuality/jpegQuality

9. 完成拍摄 → 进入 Preview（轮播或单图）

10. 用户确认 → resolve({ code: 200, data: CustomPhotoFile[], message: 'ok' })
    用户取消 → resolve({ code: 0, data: [], message: 'cancelled' })

11. Modal 关闭，holder 卸载，photoOutput 销毁
```

---

## 6. 关键实现要点

### 6.1 Camera 组件包装

```ts
// src/camera/Camera.tsx 关键骨架
import Reanimated, {
  useAnimatedProps,
  useSharedValue,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Camera as VisionCamera } from 'react-native-vision-camera';

Reanimated.addWhitelistedNativeProps({ zoom: true });
const ReanimatedCamera = Reanimated.createAnimatedComponent(VisionCamera);
```

### 6.2 Zoom（替代原"鱼眼"按钮组）

```ts
const device = useCameraDevice('back', {
  physicalDevices: ['ultra-wide-angle-camera', 'wide-angle-camera'],
});

const zoom = useSharedValue(device?.neutralZoom ?? 1);
const zoomOffset = useSharedValue(0);

const pinchGesture = Gesture.Pinch()
  .onBegin(() => { zoomOffset.value = zoom.value; })
  .onUpdate(e => {
    const z = zoomOffset.value * e.scale;
    zoom.value = interpolate(
      z, [1, 10],
      [device?.minZoom ?? 1, device?.maxZoom ?? 10],
      Extrapolation.CLAMP,
    );
  });

const animatedProps = useAnimatedProps(() => ({ zoom: zoom.value }), [zoom]);

// 镜头切换按钮
const onToggleLens = () => {
  zoom.value = zoom.value === device.neutralZoom ? device.minZoom : device.neutralZoom;
};
```

### 6.3 Tap-to-Focus（新增能力）

```ts
const camera = useRef<VisionCamera>(null);
const [focusPoint, setFocusPoint] = useState<Point | null>(null);

const handleFocus = useCallback(async (x: number, y: number) => {
  if (!device?.supportsFocus) return;
  setFocusPoint({ x, y });
  try {
    await camera.current?.focusTo({ x, y });
  } catch {}
}, [device]);

const tapGesture = Gesture.Tap()
  .onEnd(({ x, y }) => { runOnJS(handleFocus)(x, y); });

return (
  <GestureDetector gesture={Gesture.Simultaneous(pinchGesture, tapGesture)}>
    <ReanimatedCamera
      ref={camera}
      device={device}
      isActive
      outputs={[photoOutput]}
      animatedProps={animatedProps}
    />
    {focusPoint && (
      <FocusIndicator
        point={focusPoint}
        onAnimationEnd={() => setFocusPoint(null)}
      />
    )}
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

### 6.5 capturePhoto 调用

```ts
const photo = await photoOutput.capturePhoto({
  flash: flashMode,                  // 'on' | 'off' | 'auto'
  enableShutterSound: true,
});

const file: CustomPhotoFile = {
  path: photo.path,
  uri: `file://${photo.path}`,
  width: photo.width,
  height: photo.height,
  mime: 'image/jpeg',
  mode: currentMode.mode,
};
```

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

```
NSCameraUsageDescription = "App 需要访问相机以拍照"
NSMicrophoneUsageDescription = "App 需要访问麦克风以录制视频"
NSPhotoLibraryAddUsageDescription = "保存照片到相册"
```

`example/android/app/src/main/AndroidManifest.xml` 添加：

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```

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

| 风险 | 缓解 |
|---|---|
| vision-camera 5.x 稳定性（较新） | example 应用真机验证；如阻塞，降级到 4.7.3（保留分支） |
| 消费方 `retail-pecportal` 用了 deep import 类型路径 | 提供顶层导出后清晰的迁移 diff，PR 改 3-5 行 |
| RN 0.85 + New Arch + Nitro Modules 在 Android 老机型上可能性能差 | 在 example 应用测试 Android 7/8 老设备 |
| Yarn 4 与 corepack 配置不当导致拉取失败 | README 注明 `corepack enable` |
| iOS Privacy Manifest（PrivacyInfo.xcprivacy）未覆盖相机访问 | 脚手架已生成模板，按 Apple 要求补齐 NSPrivacyAccessedAPI |

---

## 12. 实施顺序（实施计划另行编写）

1. **基础打通**：example 应用空跑能起来（iOS / Android）
2. **基础 API 骨架**：useCamera + Modal + 空白 Camera 页 → resolve `{code: 0}`
3. **设备/格式/权限**：useCameraPermission + useCameraDevice + useCameraFormat
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
