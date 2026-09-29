---
sidebar_position: 5
title: 测试（Mock）
description: '在测试环境使用随包 mock 验证调用和结果处理。'
---

# 测试（Mock）

使用官方 mock 隔离原生相机。它保留稳定的 `CameraController.open`，返回空宿主，并默认交付 `cancelled`。

```ts
jest.mock('@unif/react-native-camera', () =>
  require('@unif/react-native-camera/mock')
);
```

## 默认与成功结果

```tsx
import { renderHook } from '@testing-library/react-native';
import { useCamera, type CameraOutcome } from '@unif/react-native-camera';

it('处理取消与成功', async () => {
  const { result } = renderHook(() => useCamera());
  const [camera, holder] = result.current;
  expect(holder).toBeNull();
  const input = {
    modes: [{ mode: 'single' as const }],
    retention: 'clear' as const,
  };
  await expect(camera.open(input)).resolves.toEqual({ status: 'cancelled' });

  const selected: CameraOutcome = {
    status: 'success',
    media: [
      {
        id: 'photo-1',
        uri: 'file:///tmp/photo.jpg',
        mode: 'single',
        facing: 'back',
        mimeType: 'image/jpeg',
        width: 1440,
        height: 1920,
      },
    ],
  };
  jest.mocked(camera.open).mockResolvedValueOnce(selected);
  await expect(camera.open(input)).resolves.toEqual(selected);
});
```

## 取消交接

消费者测试应检查 `open` 收到原调用的 `signal`，并验证所属操作结束时调用 `abort()`。Mock 不启动真实交互，因此测试等待与取消时，可以为单次 `open` 提供 Promise 并监听传入信号。

## 验证边界

普通 UI、结果分支与信号交接可在 Jest 验证。权限、真实捕获、文件可读、录像停止、水印像素、内存和后台切换需要 iOS／Android 设备。Mock 不替代生产 Web；Web 的真实入口返回 `failed / unsupported`。
