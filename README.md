# @unif/react-native-camera

[![npm](https://img.shields.io/npm/v/@unif/react-native-camera.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/@unif/react-native-camera)
[![CI](https://github.com/unif-design/react-native-camera/actions/workflows/ci.yml/badge.svg)](https://github.com/unif-design/react-native-camera/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@unif/react-native-camera.svg?color=blue)](LICENSE)

基于 [react-native-vision-camera](https://github.com/mrousavy/react-native-vision-camera) 5.x 构建的 React Native 相机库，提供模态化相机界面，支持单拍 / 连拍 / 视频录制 / 捏合变焦 / 镜头切换 / 点击对焦。

## 安装

```sh
yarn add @unif/react-native-camera \
         react-native-vision-camera \
         react-native-nitro-modules \
         react-native-nitro-image \
         react-native-reanimated \
         react-native-worklets \
         react-native-reanimated-carousel \
         react-native-gesture-handler \
         react-native-safe-area-context
```

iOS 还需 `pod install`。

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
            { mode: 'single', photoQuality: 'speed', jpegQuality: 0.9 },
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
| `mode` | `'single' \| 'continuous' \| 'video'` | — | 模式 |
| `photoQuality` | `'speed' \| 'balanced' \| 'quality'` | `'speed'` | 相机管线模式，影响拍摄延迟 |
| `jpegQuality` | `number (0~1)` | `0.9` | JPEG 压缩率 |

### `CameraResult`

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | `0 \| 200 \| 403 \| 404 \| 500 \| 503` | 状态码 |
| `data` | `CustomPhotoFile[]` | 拍摄的文件列表 |
| `message` | `string` | 描述信息 |

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
  data: [{ path: '/x.jpg', uri: 'file:///x.jpg', width: 1, height: 1, mime: 'image/jpeg', mode: 'single' }],
  message: 'ok',
});
```

工具函数（`toFileUri` / `buildPhotoFile` 等）与所有类型在 mock 中保留真实实现。

## 从 v1.x 升级

`v2.0.0` 的破坏性变更：

- 移除 `cameraMode[i].photoResolution` / `videoResolution` → 改用 `photoQuality` 控制速度 / `jpegQuality` 控制文件大小
- 移除 `watermark` 配置项（将在 v2.1.x 重新加入）
- 从顶层 `@unif/react-native-camera` 直接导入类型（不再走 `/lib/typescript/src/utils` deep path）

## 许可

MIT
