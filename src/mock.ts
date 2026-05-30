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

import type { CameraApi, CameraResult } from './utils';

// 类型 + 纯工具函数(toFileUri / buildPhotoFile / depsAreSame / pxToDp)保留真实实现 ——
// 它们不碰 native,消费者测试里跑真实逻辑比 mock 更有意义。
export * from './utils';

const cancelled: CameraResult = { code: 0, data: [], message: 'cancelled' };

export function useCamera(): [CameraApi, null] {
  const api: CameraApi = {
    open: jest.fn(async () => cancelled) as CameraApi['open'],
    close: jest.fn() as CameraApi['close'],
  };
  return [api, null];
}
