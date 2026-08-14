# Camera Example 场景展厅

这是 `@unif/react-native-camera` 的中文消费方参考 App。它只使用包根公开的
`useCamera()`、`OpenConfig` 与结果类型，不直接接触 Vision Camera 的 `<Camera>`。

当前仓库开发与 example 验证运行图为：

- React Native `0.86.2`（New Architecture）
- React `19.2.3`
- `@unif/react-native-design` `0.24.0`
- Yarn `4.11.0`、Node `24.13.0`

这不是发布包兼容下限。`@unif/react-native-camera` 的公共
`peerDependencies.react-native` 为 `>=0.86.0`，`@unif/react-native-design` 为 `>=0.26.0`。

## 1. 安装

所有命令均从仓库根目录运行。只使用 Yarn，不要生成 npm lockfile。

```sh
yarn install --immutable
```

本 workspace 已安装 camera 的完整 native peers。消费 App 需要的权威清单以根
`package.json#peerDependencies` 为准，尤其不要把 `@dr.pogodin/react-native-fs`
误装成 `react-native-fs`。

Carousel 5 发布 metadata 与 Gesture Handler 3 存在唯一已批准的窄 peer 例外。npm
消费方若必须处理该 warning，只能在 `react-native-reanimated-carousel` 下做 scoped
override 并复用根 RNGH；禁止全局 override、`--force` 或 `--legacy-peer-deps`。本 Yarn
workspace 不需要额外 resolution。

## 2. 启动 Metro

在第一个终端启动 Metro：

```sh
yarn example start
```

保持该进程运行，在另一个终端安装 Pods 或启动真机 App。

## 3. 安装 iOS Pods

首次安装或 native peer 变化后，从仓库根目录运行：

```sh
BUNDLE_GEMFILE=example/Gemfile bundle exec pod install --project-directory=example/ios
```

这条命令明确使用 example 的 Bundler 环境；不要在根目录省略 `BUNDLE_GEMFILE` 后假设
Bundler 会自动找到 `example/Gemfile`。

## 4. 在 Android / iOS 真机运行

相机、录像和 Skia 水印必须用带真实摄像头的设备验收。

Android 先从 `adb devices` 取得 serial：

```sh
adb devices
yarn example android --deviceId "ANDROID_DEVICE_SERIAL"
```

iOS 先取得设备 UDID：

```sh
xcrun xctrace list devices
yarn example ios --udid "IOS_DEVICE_UDID"
```

仅做编译门禁时可运行：

```sh
yarn example build:android
yarn example build:ios
```

build 成功只证明工程可编译，不证明摄像头、Microphone、录像、文件生命周期或水印烧录在
设备上通过。

### 权限边界

- Camera：iOS `NSCameraUsageDescription`、Android
  `android.permission.CAMERA`。用户拒绝 Camera 才会得到 code `403`。
- Microphone：只在录像时需要 iOS `NSMicrophoneUsageDescription`、Android
  `android.permission.RECORD_AUDIO`。
- Microphone 拒绝会留在当前录像 session，显示可重试的录像启动错误；不会转换为
  code `403` 或 `503`，也不会伪造一条结果历史。
- 本库不写系统相册，example 也不复制媒体，因此不需要无条件添加相册、定位或读取图片
  权限。

### 模拟器边界

iOS Simulator、Android Emulator 和 web 可以用于普通界面导航、纯 JS contract 与
official mock 测试，但不能验收真实相机硬件、录像或 Skia 水印成片。没有设备结果时应
如实记录“未验证”，不能把 simulator build 当作真机矩阵。

## 5. 四个场景

App 根部只调用一次 `useCamera()`，唯一 holder 始终渲染在场景 navigator 之后。四页共享
同一个 run controller 与进程内结果历史；返回首页会卸载当前 screen，但保留各场景输入。

### 基础拍摄

每次只传入一个 `cameraMode`，可切换单拍、连拍、录像、前后摄与初始闪光。照片 mode
只带 `quality`，录像 mode 只带 `recTime`，适合作为最小复制起点。

### 多模式

一次传入 `single`、`continuous`、`video`，在相机内切换。`clear` 会在切换前确认并
清理已有文件；`retain` 会跨模式累计，便于比较返回顺序与 mode metadata。

### 水印存证

用户填写标题、手工地点与备注，点击打开时再加入当前时间。六个公开 position 都可选择。
水印只烧入 JPEG，是可视标记而非防篡改证明；该场景不会请求定位权限。

### 质量实验室

照片实验覆盖 mode 内 `quality` 与根级 `photoQualityPrioritization`、`photoHDR`；录像
实验覆盖 `recTime` 与根级 `videoBitRate`。选择“SDK 默认”时会完全省略对应 key，而不是
传 `undefined`。这些是质量参数，不是分辨率或画幅配置。

## 6. `OpenConfig` 公开边界

展厅的配置预览与实际 `api.open(config)` 使用同一个 typed factory。允许字段只有：

| 层级 | 公开字段 |
| --- | --- |
| `OpenConfig` | `cameraMode`、`dataRetainedMode`、`watermark`、`photoQualityPrioritization`、`photoHDR`、`videoBitRate` |
| `CameraMode` | `mode`、`type`、`flashMode`、`quality`、`recTime` |
| `WatermarkType` | `content`、`position` |

以下都不是 `OpenConfig`：`aspectRatio`、resolution、zoom、sound、镜头翻转。画幅、变焦、
声音与镜头翻转属于相机 Modal 内交互；不要通过任意 JSON 编辑器臆造字段。

运行时还会校验：

- `cameraMode` 是非空稠密数组；
- `quality` 是 finite `0...1`；
- `recTime` / `videoBitRate` 是 finite 正数；
- `photoHDR` 是 boolean；
- enum、watermark shape 与 `content` 数组均合法。

非法配置 resolve `500/invalid_config`，不会替换已经打开的有效 session。

## 7. 六种结果码

只有 `code === 200` 是成功。`0` 是中性取消，不是成功也不是错误。

| code | example 展示语义 | production 边界 |
| --- | --- | --- |
| `200` | 成功；展示媒体、完整 metadata、原始 JSON 与临时文件警告 | 唯一成功码 |
| `0` | 中性“已取消”；保存记录但不显示失败态 | 用户取消、close、卸载或 supersede |
| `403` | Camera 权限被拒，提示到系统设置授权 | 不代表 Microphone 拒绝 |
| `404` | fallback 后仍无前/后摄设备 | 无可用相机设备 |
| `500` | 配置无效，保留配置快照与诊断 | 只用于 `OpenConfig` 边界校验 |
| `503` | 保留的录像失败码，按错误结果展示 | 当前 production 没有触发路径 |

`503` 只通过 official mock 与结果分类层稳定验证；不要破坏设备或运行环境去“制造”它。
拍照、录像或 Microphone 的可重试 runtime 错误会留在当前 session，不擅自 settle
`403/500/503`。若 `api.open()` 的 Promise 意外 reject，controller 只记录 runtime
diagnostic，不伪造 `CameraResult`。

非 `200` 结果不展示媒体卡。每个结果的 `message` 与 code 一起用于诊断。

## 8. 临时文件所有权与非持久化

`200` resolve 前，库只把返回的 path 从本 session 的 owned registry transfer 给调用方；
这表示库不再负责删除它们，不表示文件已移出临时目录、写入相册或持久化。

example 故意不复制、不上传、不写磁盘：

- 结果历史只保存在当前 App 进程内，reload / 进程结束后消失；
- 返回媒体仍可能被系统清理；
- 生产业务必须在收到 `200` 后立即复制到业务持久目录或上传；
- 取消、删除、重拍、切模式、关闭、supersede、卸载时，库只 best-effort 回收仍归本
  session 所有的 raw、中间和未返回文件。

不要把可预览的临时 URI 当成永久资产。

## 9. 测试与构建门禁

example 消费方测试使用包内 official mock：

```ts
jest.mock('@unif/react-native-camera', () =>
  require('@unif/react-native-camera/mock')
);
```

从仓库根目录运行：

```sh
yarn test src/__tests__/example --runInBand
yarn test src/__tests__/exampleConfig.test.ts --runInBand
yarn typecheck
yarn lint
yarn test --runInBand
yarn prepare
yarn check:turbo-inputs
```

纯逻辑与 mock 测试覆盖四个配置工厂、run controller、六种结果分类、媒体 metadata、唯一
hook / holder 和 native host contract；它们不声称测试真实相机。

完整 native 门禁还包括：

```sh
BUNDLE_GEMFILE=example/Gemfile bundle exec pod install --project-directory=example/ios
yarn example build:android
yarn example build:ios
```

缺 Android SDK、Xcode/signing 或 vendor artifact 时保留原始失败证据，不修改 contract、
禁用新架构或跳过依赖来换取假绿色。

## 10. 复制到消费 App

1. 按根 README 安装 camera 与全部 peers，并配置 Camera / 按需 Microphone 权限。
2. 在 App 的稳定根组件只调用一次 `useCamera()`，把 holder 无条件渲染进树。
3. 从 `example/src/domain/scenarioConfigs.ts` 复制所需 typed factory，删除不需要的场景，
   不增加公开类型之外的字段。
4. 只按 `result.code === 200` 处理媒体，并在业务代码中立即持久化或上传。

最小装配：

```tsx
import { useCamera } from '@unif/react-native-camera';

function CaptureEntry() {
  const [api, holder] = useCamera();

  const open = async () => {
    const result = await api.open({
      cameraMode: [{ mode: 'single', type: 'back', quality: 0.9 }],
      dataRetainedMode: 'clear',
    });

    if (result.code === 200) {
      for (const file of result.data) {
        // 业务必须在这里立即复制 file.path 到持久目录或上传。
      }
    }
  };

  return (
    <>
      <Button title="打开相机" onPress={open} />
      {holder}
    </>
  );
}
```

example 不提供媒体持久化实现，也不应整页复制后误认为已有相册、上传或跨进程历史能力。
