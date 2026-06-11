// Jest mock for @unif/react-native-camera —— 供消费者在测试中替换本库,
// 避免 jest 环境加载不到 vision-camera 等 native 模块而崩溃。
//
// 用法(消费者 jest setup 或单个测试文件):
//
//   jest.mock('@unif/react-native-camera', () =>
//     require('@unif/react-native-camera/mock')
//   );
//
// 替换后 useCamera() 返回 [api, null]:api.open / api.close 是 jest.fn,
// open 默认 resolve { code: 0, data: [], message: 'cancelled' }。
// 消费者可按需覆盖单次返回:
//
//   const [api] = useCamera();
//   (api.open as jest.Mock).mockResolvedValueOnce({
//     code: 200, data: [{ path: '/x.jpg', uri: 'file:///x.jpg', width: 1, height: 1,
//                         mime: 'image/jpeg', mode: 'single' }], message: 'ok',
//   });

import { useRef } from 'react';
import { cancelledResult } from './utils';
import type { CameraApi } from './utils';

// 类型 + 纯工具函数(toFileUri / buildPhotoFile / depsAreSame / pxToDp / cancelledResult)保留真实实现 ——
// 它们不碰 native,消费者测试里跑真实逻辑比 mock 更有意义。
export * from './utils';

export function useCamera(): [CameraApi, null] {
  // api 用 useRef 固定(对齐真实 useCamera 的 useMemo 稳定):每次渲染返回**同一** api 对象,
  // 消费者 `useEffect(..., [api])` 不会反复触发,`mockResolvedValueOnce` 也不会因重渲被新 jest.fn 顶掉。
  const apiRef = useRef<CameraApi | null>(null);
  const api =
    apiRef.current ??
    (apiRef.current = {
      open: jest.fn(async () => cancelledResult()) as CameraApi['open'],
      close: jest.fn() as CameraApi['close'],
    });
  return [api, null];
}
