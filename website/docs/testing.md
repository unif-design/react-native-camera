---
sidebar_position: 5
title: 测试（Mock）
description: "在 Jest 中用官方 mock 替换 @unif/react-native-camera：useCamera() 返回 [api, null]，api.open 默认 resolve { code: 0 }，工具函数与类型保留真实实现。"
---

# 测试（Mock）

本库依赖 `react-native-vision-camera` 等原生模块,Jest 环境加载不到会崩溃。官方提供整包 mock,在测试里替换本库即可。

---

## 启用 mock

在 Jest setup 或单个测试文件里整包替换:

```js
jest.mock('@unif/react-native-camera', () =>
  require('@unif/react-native-camera/mock')
);
```

替换后:

- `useCamera()` 返回 `[api, null]`(holder 为 `null`,无需渲染)。
- `api.open` / `api.close` 是 `jest.fn`。
- `api.open` **默认 resolve `{ code: 0, data: [], message: 'cancelled' }`**(模拟用户取消)。
- **工具函数(`toFileUri` / `buildPhotoFile` 等)与所有类型保留真实实现** —— 它们不碰原生,跑真实逻辑比 mock 更有意义,无需额外 stub。

---

## 覆盖单次返回(成功用例)

默认是取消(`code: 0`)。要测拍照成功,用 `mockResolvedValueOnce` 覆盖一次返回:

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

---

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
    const res = await api.open({ cameraMode: [{ mode: 'single' }], dataRetainedMode: 'clear' });
    expect(res.code).toBe(0);
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
    const res = await api.open({ cameraMode: [{ mode: 'single' }], dataRetainedMode: 'clear' });
    expect(res.code).toBe(200);
    expect(res.data).toHaveLength(1);
  });
});
```

---

## 下一步

- [核心概念 → result code](/docs/getting-started/concepts) —— `CameraResult.code` 各值含义
- [常见问题](/docs/troubleshooting) —— 真机 / 模拟器限制与排障
