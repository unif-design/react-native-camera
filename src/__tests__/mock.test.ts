import { renderHook } from '@testing-library/react-native';
import { useCamera, toFileUri } from '../mock';

// mock 版 useCamera 现在是真正的 hook(用 useRef 固定 api 身份,对齐真实实现),
// 故须在 render 内调用 —— 用 renderHook 而非模块顶层直接调。

it('mock useCamera returns [api, null] with jest.fn open/close', () => {
  const { result } = renderHook(() => useCamera());
  const [api, holder] = result.current;
  expect(holder).toBeNull();
  expect(jest.isMockFunction(api.open)).toBe(true);
  expect(jest.isMockFunction(api.close)).toBe(true);
});

it('mock open() defaults to cancelled', async () => {
  const { result } = renderHook(() => useCamera());
  const [api] = result.current;
  await expect(
    api.open({ cameraMode: [{ mode: 'single' }], dataRetainedMode: 'clear' })
  ).resolves.toEqual({ code: 0, data: [], message: 'cancelled' });
});

it('mock open() can be overridden per call', async () => {
  const { result } = renderHook(() => useCamera());
  const [api] = result.current;
  (api.open as jest.Mock).mockResolvedValueOnce({
    code: 200,
    data: [],
    message: 'ok',
  });
  const r = await api.open({
    cameraMode: [{ mode: 'single' }],
    dataRetainedMode: 'clear',
  });
  expect(r.code).toBe(200);
});

it('mock useCamera 返回稳定 api(同一 render 内多次读取身份不变)', () => {
  const { result, rerender } = renderHook(() => useCamera());
  const first = result.current[0];
  rerender({});
  expect(result.current[0]).toBe(first);
});

it('mock preserves real utils', () => {
  expect(toFileUri('/tmp/x.jpg')).toBe('file:///tmp/x.jpg');
});
