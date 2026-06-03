---
sidebar_position: 2
title: 快速上手
description: "用 useCamera 5 分钟跑通第一次拍照：useCamera() 取 [api, holder]，await api.open(config)，按 code === 200 取 res.data。"
---

# 快速上手

5 分钟跑通第一次拍照:取 `[api, holder]` → 渲染 `holder` → `await api.open(config)` → 按 `code === 200` 取文件。

:::warning 必须真机运行
相机依赖真实摄像头硬件,**模拟器 / Web 跑不起来**(属预期行为)。请在真机上验证。先完成[安装](/docs/getting-started/installation)(peerDeps + 权限键 + `pod install`)再运行本例。
:::

---

## 最小可跑示例

```tsx
import React from 'react';
import { View, Button } from 'react-native';
import { useCamera, type CameraResult } from '@unif/react-native-camera';

export default function PhotoScreen() {
  const [api, holder] = useCamera(); // ① 取 api + holder

  const onShoot = async () => {
    const res: CameraResult = await api.open({   // ③ 弹出相机,await 结果
      cameraMode: [{ mode: 'single', quality: 0.9 }],
      dataRetainedMode: 'clear',
    });
    if (res.code === 200) {                        // ④ 200 才是成功
      // res.data 是 CustomPhotoFile[],每项含 .uri / .path / .width / .height / .mime
      console.log(res.data[0]?.uri);
    }
    // 其余 code:0 取消 / 403 无权限 / 404 无设备 / 500 拍摄失败 / 503 录像失败
  };

  return (
    <View>
      <Button title="拍照" onPress={onShoot} />
      {holder}{/* ② holder 必须渲染进树,否则相机不弹 */}
    </View>
  );
}
```

跑起来后点「拍照」即弹出全屏相机,拍完确认,`res.data[0].uri` 就是拍到的照片。

---

## 逐步讲解

### ① 取 `api` 和 `holder`

```tsx
const [api, holder] = useCamera();
```

`useCamera()` 无参,返回一个二元组:

- **`api`** —— `CameraApi`,提供 `open(config)` / `close()`,控制相机开关。
- **`holder`** —— `React.ReactElement`,相机模态的 React 宿主节点。

### ② 渲染 `holder`

```tsx
{holder}
```

`holder` **必须出现在 React 树中**,它是全屏相机模态的挂载点。位置不影响视觉(打开时全屏覆盖),但**节点必须存在**,否则 `api.open()` 静默无效、相机不弹。

### ③ 打开相机

```tsx
const res = await api.open({
  cameraMode: [{ mode: 'single', quality: 0.9 }],
  dataRetainedMode: 'clear',
});
```

`api.open(config)` 返回 `Promise<CameraResult>`,用户拍完确认(或取消)后 resolve。配置:

- **`cameraMode`** —— 拍摄模式数组,至少一项。`mode: 'single'` 单拍;`quality`(0~1)是 JPEG 压缩系数,默认 `0.9`。想给用户多个模式 tab,就多传几项,如 `[{ mode: 'single' }, { mode: 'continuous' }, { mode: 'video' }]`。
- **`dataRetainedMode`** —— 用户切换模式时:`'clear'` 清除已拍文件,`'retain'` 保留。

### ④ 按 `code` 处理结果

```tsx
if (res.code === 200) {
  console.log(res.data[0]?.uri);
}
```

`res` 是 `CameraResult`,**只有 `code === 200` 才是成功**(此时 `res.data` 是文件列表):

| code | 含义 |
| --- | --- |
| `200` | 用户确认保存,`res.data` 含文件列表 |
| `0` | 用户取消(未拍或点返回) |
| `403` | 无相机权限 |
| `404` | 无可用摄像设备 |
| `500` | 拍摄失败 / 配置非法 |
| `503` | 录像失败 |

:::danger 不要把 `0` 当成功
`0` 是「取消」,此时 `res.data` 为空。务必判 `code === 200`,不要写成 `code === 0`。
:::

---

## 下一步

- [核心概念](/docs/getting-started/concepts) —— 模态相机 / holder / 生命周期 / result code 心智模型
- [指南 → 拍照](/docs/guides/taking-photos) —— 单拍 / 连拍配置与预览详解
- [API 参考 → useCamera](/docs/api/use-camera) —— `useCamera` 完整 API
