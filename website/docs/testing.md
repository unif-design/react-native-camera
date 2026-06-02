---
sidebar_position: 5
title: 测试(Mock)
description: "在 Jest 测试环境中 mock @unif/react-native-camera，避免加载 native 模块。"
---

# 测试(Mock)

本库依赖 `react-native-vision-camera` 等 native 模块，jest 环境无法直接加载。消费者在测试里 mock 本库：

```js
jest.mock('@unif/react-native-camera', () =>
  require('@unif/react-native-camera/mock')
);
```

mock 后 `useCamera()` 返回 `[api, null]`，`api.open` / `api.close` 是 `jest.fn`，`open` 默认 resolve `{ code: 0, data: [], message: 'cancelled' }`。

## 覆盖单次返回

按需用 `mockResolvedValueOnce` 覆盖 `open` 的返回值：

```ts
const [api] = useCamera();
(api.open as jest.Mock).mockResolvedValueOnce({
  code: 200,
  data: [
    {
      id: '1700000000000-0',
      cameraType: 'back',
      cameraMode: 'single',
      path: '/x.jpg',
      uri: 'file:///x.jpg',
      width: 1,
      height: 1,
      mime: 'image/jpeg',
      mode: 'single',
    },
  ],
  message: 'ok',
});
```

## 工具函数与类型

工具函数（`toFileUri` / `buildPhotoFile` 等）与所有类型在 mock 中保留真实实现，无需额外 stub。

## 完整示例

```ts
import { useCamera } from '@unif/react-native-camera';

jest.mock('@unif/react-native-camera', () =>
  require('@unif/react-native-camera/mock')
);

describe('拍照流程', () => {
  it('用户取消时 code 为 0', async () => {
    const [api] = useCamera();
    // open 默认 resolve { code: 0, data: [], message: 'cancelled' }
    const result = await api.open({ cameraMode: [{ mode: 'single' }], dataRetainedMode: 'clear' });
    expect(result.code).toBe(0);
  });

  it('拍照成功时返回文件列表', async () => {
    const [api] = useCamera();
    (api.open as jest.Mock).mockResolvedValueOnce({
      code: 200,
      data: [
        {
          id: '1700000000000-0',
          cameraType: 'back',
          cameraMode: 'single',
          path: '/x.jpg',
          uri: 'file:///x.jpg',
          width: 1,
          height: 1,
          mime: 'image/jpeg',
          mode: 'single',
        },
      ],
      message: 'ok',
    });
    const result = await api.open({ cameraMode: [{ mode: 'single' }], dataRetainedMode: 'clear' });
    expect(result.code).toBe(200);
    expect(result.data).toHaveLength(1);
  });
});
```
