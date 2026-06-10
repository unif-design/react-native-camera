---
sidebar_position: 3
title: 核心概念
description: "理解 @unif/react-native-camera 的核心心智模型：模态相机、holder 渲染、api.open(config) 的 Promise 生命周期、cameraMode/dataRetainedMode、CameraResult.code（200/0/403/404/500/503）、Skia 水印（仅 JPEG）。"
---

# 核心概念

在深入 API 前,先建立几个核心心智模型——它们解释了这个库「为什么这样设计」与使用时的关键约束。

---

## 模型一:模态相机,不是内嵌取景器

`@unif/react-native-camera` 提供的是**模态化相机**,而不是嵌进页面布局的取景器组件。

调用 `api.open()` 会弹出一个**全屏模态界面**,用户在模态内完成所有操作(切换模式、拍照、预览、确认或取消),确认后模态关闭,结果通过 Promise 返回。

这与把 `<CameraView />` 内嵌到页面布局的模式完全不同:

- **调用方不管相机 UI 的布局和层叠** —— 模态自己全屏覆盖。
- **拍摄流程是线性的** —— `await api.open(...)` 挂起,拍完才继续,逻辑简单。
- **适合「按需拍照」** —— 表单附件、巡检记录、工单照片;不适合持续取景的 AR / 扫码场景(扫码请用 `@unif/react-native-hms-scan`)。

模态内的取景控件由库内置、用户自行操作(无需调用方配置):双指 pinch 变焦(含 `0.5x` 超广角与 `0.5/1` 档位快捷跳档)、点击对焦、前后摄翻转、画幅切换(`4:3` / `16:9`,**默认 `16:9`**)、闪光(`auto`/`on`/`off` 轮换)、快门声开关。

---

## 模型二:`useCamera()` → `[api, holder]`,holder 必须渲染

`useCamera()` 无参,返回二元组 `[api, holder]`:

- **`api`** —— `CameraApi`,有两个方法:`open(config)` 弹出相机并返回 Promise;`close()` 主动收起(等价于用户取消,resolve `code: 0`)。
- **`holder`** —— 相机模态的 React 宿主节点(`React.ReactElement`)。

```tsx
const [api, holder] = useCamera();

return (
  <View>
    {/* 其他 UI */}
    {holder}  {/* 必须在树中 */}
  </View>
);
```

**`holder` 必须出现在 React 树中**,原因:

- 相机模态是通过 React 组件树挂载的,不是 imperative 的原生调用。
- `holder` 是相机 UI 的挂载锚点;缺它,`api.open()` 找不到渲染目标,调用**静默无效**。
- `holder` 的位置(在父节点哪一层)不影响视觉——相机打开时全屏覆盖——但**节点必须存在于组件树内**。

推荐在页面组件或根 App 里一次性放置 `{holder}`,无需每次调用前重新挂载。

---

## 模型三:`api.open(config)` 返回 Promise,有完整生命周期

`api.open(config)` 返回 `Promise<CameraResult>`,生命周期如下:

```
api.open(config)
    │
    ▼
  [打开]  全屏模态弹出,进入拍摄界面
    │
    ▼
  [拍摄]  用户拍照 / 录像(单拍 / 连拍 / 视频)
    │
    ▼
  [确认]  预览页:确认使用 / 重拍 / 取消
    │
    ▼
  [关闭]  模态收起
    │
    ▼
Promise.resolve(CameraResult)
```

关键特性:

- **挂起调用方** —— `await api.open(...)` 会等整个流程(确认或取消)完成才继续。
- **取消也 resolve** —— 用户取消时 `code` 为 `0`,**不会 reject**。
- **水印在每次快门后逐张烧入** —— 若传 `watermark`,相机在**每次快门后**对该张照片逐张烧入(`image/jpeg`,串行)(期间 footer 提示「正在生成水印图片…」)。Promise resolve 时水印已烧入成片。

### `config`:`cameraMode` 与 `dataRetainedMode`

`api.open(config)` 的入参是 `OpenConfig`:

- **`cameraMode: CameraMode[]`** —— 拍摄模式数组,至少一项。每项的 `mode` 为 `'single'`(单拍) / `'continuous'`(连拍) / `'video'`(录像);可选 `quality`(0~1 JPEG 压缩系数,默认 `0.9`)。传多项时,相机底部出现模式 tab 供用户切换。
- **`dataRetainedMode: 'clear' | 'retain'`** —— 用户切换模式时:`'clear'` 清除已拍文件,`'retain'` 保留。
- **`watermark?`** —— 可选,见模型五。

> `CameraMode` 还有 `type`(初始前/后摄)、`flashMode`、`recTime` 等兼容字段。完整字段见 [API → 类型](/docs/api/types)。

---

## 模型四:用 `CameraResult.code` 判定结果

`api.open()` resolve 出 `CameraResult = { code, data, message }`。**只有 `code === 200` 才是成功**:

| code | 含义 | 处理 |
| --- | --- | --- |
| `200` | 用户确认保存(成功) | 取 `res.data`(`CustomPhotoFile[]`) |
| `0` | 取消 / 关闭 | 静默,`data` 为空 |
| `403` | 无相机权限 | 引导用户去系统设置开权限 |
| `404` | 无可用摄像设备 | 提示设备不支持 |
| `500` | 拍摄失败 / 配置非法 | 兜底提示,排查 `config` |
| `503` | 录像失败 | 兜底提示 |

成功时 `res.data` 的每一项是 `CustomPhotoFile`,含 `uri` / `path` / `width` / `height` / `mime`(`'image/jpeg'` 或 `'video/mp4'`)等字段。

:::danger 别把 `0` 当成功
`0` 是「取消」,此时 `data` 为空。判定务必用 `code === 200`。各 code 的处理范式见[常见问题](/docs/troubleshooting)。
:::

---

## 模型五:Skia 水印(仅照片)

传入 `watermark` 后,相机在用户确认时用 **Skia** 把多行文字**离屏合成、烧进成片**:

```ts
watermark: {
  content: ['Unif · 巡检', '上海浦东', '2024-01-01 10:00'], // 每项一行
  position: 'top-right', // 六选一,默认 'top-right'
}
```

关键约束:

- **仅对照片(`image/jpeg`)生效** —— 水印烧图把结果编码为 JPEG;**录像(`video/mp4`)没有水印**。
- **是可视标记,不是防篡改手段** —— 水印只是叠加在像素上的文字,不提供任何加密 / 防伪 / 签名保证。
- **烧图失败不阻断保存** —— 读写或解码异常时返回原图,拍摄照常成功。

> 水印用法详解见[指南 → 水印](/docs/guides/watermark)。

---

## 术语表

| 术语 | 一句话定义 | 详情 |
| --- | --- | --- |
| `useCamera()` | 唯一公开 Hook,返回 `[api, holder]` | 模型二 |
| holder | 相机模态的 React 宿主节点,必须渲染进树 | 模型二 |
| `CameraApi` | `api` 对象,含 `open(config)` / `close()` | [API → useCamera](/docs/api/use-camera) |
| `OpenConfig` | `api.open()` 入参:`cameraMode[]` + `dataRetainedMode`(+ 可选 `watermark`) | [API → 类型](/docs/api/types) |
| `CameraMode` | 单个拍摄模式配置(`mode` + 可选 `quality`/`type`/`flashMode`/`recTime`) | [API → 类型](/docs/api/types) |
| `dataRetainedMode` | 切模式时是否保留已拍文件:`'clear'` / `'retain'` | 模型三 |
| `CameraResult` | `api.open()` 的 resolve 值:`code` + `data` + `message` | 模型四 |
| `CustomPhotoFile` | 单个文件描述对象,含 `uri` / `path` / `width` / `height` / `mime` 等 | [API → 类型](/docs/api/types) |

---

## 下一步

- [指南 → 拍照](/docs/guides/taking-photos) —— 单拍 / 连拍配置详解
- [API 参考 → useCamera](/docs/api/use-camera) —— 完整 hook API
- [API 参考 → 类型](/docs/api/types) —— 所有类型定义
