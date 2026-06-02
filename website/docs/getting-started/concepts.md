---
sidebar_position: 3
title: 核心概念
description: 理解 @unif/react-native-camera 的三个核心心智模型：模态相机、holder 渲染、Promise 生命周期。
---

# 核心概念

在深入 API 之前，先理解三个核心心智模型——它们解释了这个库"为什么这样设计"，以及使用时应注意的关键约束。

---

## 心智模型一：模态相机

`@unif/react-native-camera` 提供的是**模态化相机**，而不是内嵌取景器组件。

调用 `api.open()` 会弹出一个**全屏模态界面**，用户在模态内完成所有拍摄操作（切换模式、拍照、预览、确认或取消），确认后模态关闭，结果通过 Promise 返回给调用方。

这与把 `<CameraView />` 内嵌到页面布局的模式完全不同：

- **调用方不需要管理相机 UI 的布局和层叠**——模态自己全屏覆盖。
- **拍摄流程是线性的**——`await api.open(...)` 挂起，拍完才继续，逻辑简单。
- **适合"按需拍照"场景**——如表单附件、拜访记录、工单照片，不适合持续取景的 AR / 扫码场景。

---

## 心智模型二：holder 必须渲染进 React 树

`useCamera()` 返回 `[api, holder]`，其中 `holder` 是相机模态的 React 宿主节点。

```tsx
const [api, holder] = useCamera();

return (
  <View>
    {/* 其他 UI */}
    {holder}  {/* 必须在树中 */}
  </View>
);
```

**`holder` 必须出现在 React 树中**，原因：

- 相机模态是通过 React 组件树挂载的，而不是 imperative DOM/Native 调用。
- `holder` 是相机 UI 的挂载锚点；缺少它，`api.open()` 找不到渲染目标，调用会静默无效。
- `holder` 的位置（在父节点哪个层级）不影响视觉效果——相机打开时是全屏覆盖层，但**节点必须存在于组件树内**。

推荐在页面组件或根 App 中一次性放置 `{holder}`，无需每次调用前重新挂载。

---

## 心智模型三：`api.open()` 返回 Promise，有完整生命周期

`api.open(config)` 返回 `Promise<CameraResult>`，其生命周期如下：

```
api.open(config)
    │
    ▼
  [打开]  全屏模态弹出，用户进入拍摄界面
    │
    ▼
  [拍摄]  用户拍照 / 录像（单拍 / 连拍 / 视频）
    │
    ▼
  [确认]  预览页：用户确认使用 或 重拍 或 取消
    │
    ▼
  [关闭]  模态收起
    │
    ▼
Promise.resolve(CameraResult)
```

关键特性：

- **挂起调用方**：`await api.open(...)` 会等待整个流程完成（用户确认或取消）才继续后续代码。
- **取消也会 resolve**：用户点取消时 `code` 为 `0`，不会 reject。只有运行时错误才会 reject（实践中极少见）。
- **水印在确认后异步处理**：若传入 `watermark` 配置，相机会在确认后串行烧入水印再 resolve；期间 footer 显示"正在生成水印图片…"提示。Promise resolve 时水印已烧入成片。

---

## 术语表

| 术语 | 一句话定义 | 详情 |
| --- | --- | --- |
| `CameraMode` | 单次拍摄模式配置项（`mode` + `quality` + 可选 `type`/`flashMode`/`recTime`） | [API → types](/docs/api/types) |
| `OpenConfig` | `api.open()` 的入参，包含 `cameraMode[]` 数组、`dataRetainedMode`（+ 可选 `watermark`） | [API → types](/docs/api/types) |
| `CameraResult` | `api.open()` 的 resolve 值，包含 `code`、`data`（文件列表）、`message` | [API → types](/docs/api/types) |
| `CustomPhotoFile` | 单张照片 / 视频文件的描述对象，含路径、尺寸、MIME 类型等 | [API → types](/docs/api/types) |
| holder | `useCamera()` 返回的第二个元素，相机模态的 React 宿主节点，必须渲染进树 | 本页心智模型二 |
| `dataRetainedMode` | 用户切换拍摄模式时是否保留已拍文件：`'clear'` 清除 / `'retain'` 保留 | [API → types](/docs/api/types) |

---

## 下一步

- [指南 → 拍照](/docs/guides/taking-photos) — 单拍 / 连拍配置详解
- [API 参考 → useCamera](/docs/api/use-camera) — 完整 hook API
- [API 参考 → 类型](/docs/api/types) — 所有类型定义
