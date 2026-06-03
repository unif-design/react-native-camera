---
sidebar_position: 1
title: useCamera
description: "useCamera() Hook：无参调用，返回 [api, holder] 二元组——api 控制相机开关，holder 是必须渲染进树的相机宿主节点。"
---

# useCamera

`@unif/react-native-camera` 的**唯一入口 Hook**。无参调用，返回 `[api, holder]` 二元组：`api` 用来打开 / 关闭相机，`holder` 是相机全屏模态的宿主节点，必须渲染进 React 树。

---

## 引用 / 签名 {#signature}

```ts
import { useCamera } from '@unif/react-native-camera';
```

```ts
const [api, holder] = useCamera();
```

**TypeScript 签名：**

```ts
function useCamera(): [CameraApi, React.ReactElement]
```

`useCamera()` **不接受任何参数**——所有拍摄配置都在调用 [`api.open(config)`](/docs/api/camera-api) 时传入。

---

## 返回值 {#return}

返回一个二元组 `[CameraApi, React.ReactElement]`：

| 返回值 | 类型 | 说明 |
| --- | --- | --- |
| `api` | [`CameraApi`](/docs/api/camera-api) | 相机控制对象，提供 `open()` / `close()` 方法 |
| `holder` | `React.ReactElement` | 相机 UI（全屏模态）的宿主节点，**必须渲染进 React 树** |

`holder` 本质是一个 `<ModalView>` 节点（内部已自带 `SafeAreaProvider` + `ThemeProvider`），相机未打开时不显示任何内容。`api.open()` 只是把这个模态切到可见态并保存 resolver——**没有 `holder` 挂载就没有挂载锚点，`api.open()` 会静默无效、相机不弹出**。

---

## 示例 {#example}

```tsx
import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useCamera } from '@unif/react-native-camera';

const PhotoScreen = () => {
  const [api, holder] = useCamera();

  const handleOpen = async () => {
    const res = await api.open({
      cameraMode: [{ mode: 'single', quality: 0.9 }],
      dataRetainedMode: 'clear',
    });
    if (res.code === 200) {
      // res.data 是 CustomPhotoFile[] 文件列表
    }
  };

  return (
    <View>
      <TouchableOpacity onPress={handleOpen}>
        <Text>打开相机</Text>
      </TouchableOpacity>
      {holder}
    </View>
  );
};
```

---

## 注意事项 {#notes}

- **`holder` 必须渲染进 React 树。** 它的位置不影响视觉（相机打开时会全屏覆盖），但节点必须存在；缺少它时 `api.open()` 调用无效、相机无法显示。这是最高频的接入错误。
- **只有 `code === 200` 才是成功。** 用户取消走 `code: 0`，`data` 为空——不要把取消当成功。完整状态码见 [`CameraResult`](/docs/api/types#cameraresult)。
- **测试 mock 时 `holder` 为 `null`。** 使用官方 mock（`jest.mock('@unif/react-native-camera', () => require('@unif/react-native-camera/mock'))`）时，`useCamera()` 返回 `[api, null]`，渲染时仍可直接写 `{holder}`（React 忽略 `null`）。详见 [测试](/docs/testing)。

---

## 平台兼容性 {#platforms}

| 平台 | 支持 |
| --- | --- |
| iOS | ✅ |
| Android | ✅ |
| Web | ❌ |

---

## 相关 {#related}

- [CameraApi](/docs/api/camera-api) — `open()` / `close()` 方法完整文档
- [类型](/docs/api/types) — `OpenConfig` / `CameraResult` / `CustomPhotoFile` 类型定义
- [快速上手](/docs/getting-started/quick-start) — 最小可运行示例
