# @unif/react-native-camera

[![npm](https://img.shields.io/npm/v/@unif/react-native-camera.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/@unif/react-native-camera)
[![CI](https://github.com/unif-design/react-native-camera/actions/workflows/ci.yml/badge.svg)](https://github.com/unif-design/react-native-camera/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@unif/react-native-camera.svg?color=blue)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-unif--design.github.io-orange.svg)](https://unif-design.github.io/react-native-camera/)

基于 [react-native-vision-camera](https://github.com/mrousavy/react-native-vision-camera) 5.x 构建的 React Native 相机库，提供模态化相机界面，支持单拍 / 连拍 / 视频录制 / 捏合变焦 / 镜头切换 / 点击对焦。

## 安装

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

iOS 还需 `pod install`。

### 关于 `react-native-vision-camera-worklets`

vision-camera 5.x 把 Frame Processor / 多线程能力拆到了同伴包 `react-native-vision-camera-worklets`，并在内部通过懒 `require` 引用它。**即使本库不使用任何 Frame Processor**，消费端打包器（Metro 等）在静态解析阶段仍会解析 vision-camera 内部那处 `require`——缺失该包会直接报错：打包期 `Unable to resolve module react-native-vision-camera-worklets`，或运行时 `Cannot use Frame Processors - react-native-vision-camera-worklets is not installed`。

因此它是**必装的同伴包**，版本与 `react-native-vision-camera` 对齐（同为 `^5.x`）。vision-camera 自身未将其声明为 peer（视作可选），本库已在 `peerDependencies` 中显式声明，以提醒消费者一并安装。

### 关于 `react-native-video` 与预览

预览页的**视频播放**用 `react-native-video`（**7.x**，`useVideoPlayer` + `VideoView` API），消费端需安装并 iOS `pod install`。

预览页的**二次确认弹窗**与 **Toast** 复用 `@unif/react-native-design` 的 `confirm` / `toast`，需消费端在 App 根挂 `ConfirmHost` / `ToastHost`（与 `ThemeProvider` 一样一次性挂载）；未挂则确认/提示静默失效。

### 关于水印

传 `open({ ..., watermark: { content: ['Unif · 拜访记录', '上海市…'], position: 'top-right' } })` 即给成片加水印：

- **快门后逐张**把水印用 `@shopify/react-native-skia` 全分辨率离屏合成、烧进照片（用 `@dr.pogodin/react-native-fs` 写文件）；串行处理(一次只烧 1 张、峰值内存恒定)，烧图时 footer 显示「正在生成水印图片…」；取景器显示同款戳记作 WYSIWYG 提示；预览显示已烧成片；视频不烧。
- 消费端需安装 `@shopify/react-native-skia` + `@dr.pogodin/react-native-fs` 并 iOS `pod install`。
- `position` 六选一（`top`/`bottom` × `left`/`center`/`right`，缺省 `top-right`），文字按位置自适应对齐（右→向左扩展、中→向两侧）。
- **水印是可视记录，不防篡改**（无法阻止虚拟相机/替换照片——那是独立课题）。

### 权限配置

iOS `Info.plist`：

```xml
<key>NSCameraUsageDescription</key><string>...</string>
<key>NSMicrophoneUsageDescription</key><string>...</string>
<key>NSPhotoLibraryAddUsageDescription</key><string>...</string>
```

Android `AndroidManifest.xml`：

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```

## 用法

```tsx
import { useCamera } from '@unif/react-native-camera';

const App = () => {
  const [api, holder] = useCamera();
  return (
    <View>
      <Text onPress={async () => {
        const res = await api.open({
          cameraMode: [
            { mode: 'single', quality: 0.9 },
            { mode: 'continuous' },
          ],
          dataRetainedMode: 'clear',
        });
        // res.code: 200=ok, 0=cancelled, 403=no_permission, 404=no_device, 500=capture_failed, 503=video_failed
      }}>打开相机</Text>
      {holder}
    </View>
  );
};
```

## API

### `useCamera()` → `[api, holder]`

返回 `[CameraApi, React.ReactElement]`，把 `holder` 渲染进 React 树，调用 `api.open(config)` 打开相机。

### `CameraApi`

- `open(config: OpenConfig): Promise<CameraResult>`
- `close(): void`

### `OpenConfig`

| 字段 | 类型 | 说明 |
|---|---|---|
| `cameraMode` | `CameraMode[]` | 至少一项；多项时底部出现模式 tab |
| `dataRetainedMode` | `'clear' \| 'retain'` | 模式切换时是否保留已拍照片 |

### `CameraMode`

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `type` | `'back' \| 'front'` | `back` | 初始前/后摄 |
| `flashMode` | `'auto' \| 'on' \| 'off'` | — | 初始闪光（保留作兼容；闪光实际由相机内 UI 控制） |
| `mode` | `'single' \| 'continuous' \| 'video'` | — | 拍摄模式 |
| `quality` | `number` | `0.9` | JPEG 压缩 0~1 |
| `recTime` | `number` | — | 录制时长上限（秒，video） |

### `CameraResult`

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | `0 \| 200 \| 403 \| 404 \| 500 \| 503` | 状态码 |
| `data` | `CustomPhotoFile[]` | 拍摄的文件列表 |
| `message` | `string` | 描述信息 |

### `CustomPhotoFile`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 唯一 id |
| `cameraType` | `'back' \| 'front'` | 拍摄时的前/后摄 |
| `cameraMode` | `'single' \| 'continuous' \| 'video'` | 模式（原版字段名，= `mode`） |
| `path` | `string` | 本地文件路径 |
| `uri` | `string` | 文件 uri（`file://`） |
| `width` | `number` | 宽（px） |
| `height` | `number` | 高（px） |
| `mime` | `'image/jpeg' \| 'video/mp4'` | MIME 类型 |
| `mode` | `'single' \| 'continuous' \| 'video'` | 模式（2.x 字段名，= `cameraMode`） |
| `duration?` | `number` | 时长（秒，video） |

## 测试 (Mock)

本库依赖 `react-native-vision-camera` 等 native 模块，jest 环境无法直接加载。消费者在测试里 mock 本库：

```js
jest.mock('@unif/react-native-camera', () =>
  require('@unif/react-native-camera/mock')
);
```

mock 后 `useCamera()` 返回 `[api, null]`，`api.open` / `api.close` 是 `jest.fn`，`open` 默认 resolve `{ code: 0, data: [], message: 'cancelled' }`。按需覆盖单次返回：

```ts
const [api] = useCamera();
(api.open as jest.Mock).mockResolvedValueOnce({
  code: 200,
  data: [{ id: '1700000000000-0', cameraType: 'back', cameraMode: 'single', path: '/x.jpg', uri: 'file:///x.jpg', width: 1, height: 1, mime: 'image/jpeg', mode: 'single' }],
  message: 'ok',
});
```

工具函数（`toFileUri` / `buildPhotoFile` 等）与所有类型在 mock 中保留真实实现。

## 从 v1.x 升级

`v2.0.0` 的破坏性变更：

- 移除 `cameraMode[i].photoResolution` / `videoResolution` → 改用 `quality`（0~1）控制 JPEG 压缩
- 移除 `watermark` 配置项（将在 v2.1.x 重新加入）
- 从顶层 `@unif/react-native-camera` 直接导入类型（不再走 `/lib/typescript/src/utils` deep path）

## 许可

MIT
