---
sidebar_position: 1
title: useCamera
description: 'useCamera 的调用、宿主节点和返回值。'
---

# useCamera

`useCamera()` 返回稳定的调用接口和需要渲染的相机宿主。宿主挂载不会预先启动相机，调用 `open()` 才开始拍摄交互。

## 签名 {#signature}

```tsx
import { useCamera } from '@unif/react-native-camera';

const [camera, holder] = useCamera();
// readonly [CameraController, ReactElement]
```

所有拍摄参数通过 `camera.open(input, options?)` 提供，Hook 本身无参数。

## 挂载宿主 {#return}

在稳定的组件树中渲染 `{holder}`。未挂载宿主时，合法输入明确返回 `failed / unavailable`，不会排队等待。真实卸载宿主会取消当前调用；React effect 的临时重放不视为用户取消。

```tsx
import { Button, View } from 'react-native';
import { useCamera } from '@unif/react-native-camera';

export function PhotoScreen() {
  const [camera, holder] = useCamera();
  const takePhoto = async () => {
    const outcome = await camera.open({
      modes: [{ mode: 'single', quality: 0.9 }],
      retention: 'clear',
    });
    if (outcome.status === 'success') {
      console.log(outcome.media[0]?.uri);
    }
  };
  return (
    <View>
      <Button title="拍照" onPress={takePhoto} />
      {holder}
    </View>
  );
}
```

完整取消与替换行为见 [CameraController](/docs/api/camera-api)。官方测试 mock 返回空宿主，详见[测试](/docs/testing)。

## 平台

iOS 与 Android 使用原生拍摄。Web 入口隔离原生模块，`open()` 返回 `failed / unsupported`；Mock 仅用于测试。
