---
sidebar_position: 2
title: 快速上手
description: '使用 useCamera 打开相机并处理拍摄结果。'
---

# 快速上手

完成[安装与权限配置](/docs/getting-started/installation)后，在真机运行以下示例。

## 代码示例

```tsx
import React from 'react';
import { View, Button } from 'react-native';
import { useCamera, type CameraResult } from '@unif/react-native-camera';

export default function PhotoScreen() {
  const [api, holder] = useCamera(); // ① 取 api + holder

  const onShoot = async () => {
    const res: CameraResult = await api.open({
      // ③ 弹出相机,await 结果
      cameraMode: [{ mode: 'single', quality: 0.9 }],
      dataRetainedMode: 'clear',
    });
    if (res.code === 200) {
      // ④ 200 才是成功
      // res.data 是 CustomPhotoFile[],每项含 .uri / .path / .width / .height / .mime
      console.log(res.data[0]?.uri);
    }
    // 其余 code:0 取消 / 403 无权限 / 404 无设备 / 500 配置非法(拍摄失败走相机内重试)
  };

  return (
    <View>
      <Button title="拍照" onPress={onShoot} />
      {holder}
      {/* ② holder 必须渲染进树,否则相机不弹且 Promise 保持 pending */}
    </View>
  );
}
```

## 接入要点

- 在稳定的组件树中渲染 `holder`。
- 将拍摄模式等配置传给 `api.open()`。
- 仅在 `code === 200` 时处理媒体，`0` 表示取消。
- 需要长期保留文件时，由应用保存或上传。

多次打开、局部拍摄失败和文件归属见[调用与资源](/docs/getting-started/concepts)。参数见[类型参考](/docs/api/types)，遇到问题查看[FAQ](/docs/troubleshooting)。
