---
sidebar_position: 2
title: 快速上手
description: '使用 useCamera 打开相机并处理拍摄结果。'
---

# 快速上手

先完成[依赖与权限安装](/docs/getting-started/installation)。下面的组件使用公开入口拍一张照片。

```tsx
import { Button, Text, View } from 'react-native';
import { useState } from 'react';
import { useCamera } from '@unif/react-native-camera';

export function PhotoScreen() {
  const [camera, holder] = useCamera();
  const [message, setMessage] = useState('');
  async function takePhoto() {
    const result = await camera.open({
      modes: [{ mode: 'single', quality: 0.9 }],
      retention: 'clear',
    });
    switch (result.status) {
      case 'success':
        setMessage(result.media.map((media) => media.uri).join('\n'));
        break;
      case 'cancelled':
        setMessage('已取消');
        break;
      case 'failed':
        setMessage(result.error.message);
        break;
    }
  }
  return (
    <View>
      <Button title="拍照" onPress={takePhoto} />
      <Text>{message}</Text>
      {holder}
    </View>
  );
}
```

宿主必须挂载；缺少宿主会明确失败。需要外部取消时传入本次调用的 `AbortSignal`，见[调用生命周期](/docs/api/camera-api#open-lifecycle)。成功结果是临时媒体，实际业务应及时保存或上传。
