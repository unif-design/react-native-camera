---
sidebar_position: 1
title: useCamera
description: 初始化相机实例，返回控制 API 与宿主节点的 React Hook。
---

# useCamera

初始化相机实例，返回控制 API 与宿主节点的 React Hook。

---

## 引用 / 签名

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

---

## 返回值

`useCamera()` 返回一个二元组 `[CameraApi, React.ReactElement]`：

| 返回值 | 类型 | 说明 |
| --- | --- | --- |
| `api` | `CameraApi` | 相机控制对象，提供 `open()` / `close()` 方法 |
| `holder` | `React.ReactElement` | 相机 UI 的 React 宿主节点，**必须渲染进 React 树** |

---

## 示例

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

## 注意事项

- **`holder` 必须渲染进 React 树。** `holder` 是相机全屏模态的挂载宿主，缺少它时 `api.open()` 调用无效、相机无法显示。`holder` 的位置不影响视觉（相机打开时会全屏覆盖），但节点必须存在。
- **测试 mock 时 `holder` 为 `null`。** 使用官方 mock（`jest.mock('@unif/react-native-camera', () => require('@unif/react-native-camera/mock'))`）时，`useCamera()` 返回 `[api, null]`，渲染时可用 `{holder}` 直接放置（React 会忽略 `null`）。详见 [Testing](/docs/testing)。
- `useCamera()` 不接受任何参数；所有拍摄配置均在调用 `api.open(config)` 时传入。

---

## 平台兼容性

| 平台 | 支持 |
| --- | --- |
| iOS | ✅ |
| Android | ✅ |
| Web | ❌ |

---

## 相关

- [CameraApi](/docs/api/camera-api) — `open()` / `close()` 方法完整文档
- [类型](/docs/api/types) — `OpenConfig` / `CameraResult` / `CustomPhotoFile` 类型定义
- [快速上手](/docs/getting-started/quick-start) — 最小可运行示例
