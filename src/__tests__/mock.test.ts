import { isValidElement } from 'react';
import { renderHook } from '@testing-library/react-native';
import { useCamera } from '../mock';
import type { CameraOutcome } from '../types';

// mock 版 useCamera 现在是真正的 hook(用 useRef 固定 api 身份,对齐真实实现),
// 故须在 render 内调用 —— 用 renderHook 而非模块顶层直接调。

it('mock useCamera returns [api, ReactElement] with only jest.fn open', () => {
  const { result } = renderHook(() => useCamera());
  const [api, holder] = result.current;
  expect(isValidElement(holder)).toBe(true);
  expect(jest.isMockFunction(api.open)).toBe(true);
  expect(Object.keys(api)).toEqual(['open']);
});

it('mock open() defaults to cancelled', async () => {
  const { result } = renderHook(() => useCamera());
  const [api] = result.current;
  await expect(
    api.open({ modes: [{ mode: 'single' }], retention: 'clear' })
  ).resolves.toEqual({ status: 'cancelled' });
});

it('mock open() can be overridden per call', async () => {
  const { result } = renderHook(() => useCamera());
  const [api] = result.current;
  const success: CameraOutcome = {
    status: 'success',
    media: [
      {
        id: '1',
        facing: 'back',

        uri: 'file:///tmp/photo.jpg',
        width: 1080,
        height: 1920,
        mimeType: 'image/jpeg',
        mode: 'single',
      },
    ],
  };
  (api.open as jest.Mock).mockResolvedValueOnce(success);
  const r = await api.open({
    modes: [{ mode: 'single' }],
    retention: 'clear',
  });
  expect(r.status).toBe('success');
  if (r.status !== 'success') throw new Error('expected success');
  expect(r.media).toEqual(success.media);
});

it('mock useCamera 返回稳定 api(同一 render 内多次读取身份不变)', () => {
  const { result, rerender } = renderHook(() => useCamera());
  const first = result.current[0];
  rerender({});
  expect(result.current[0]).toBe(first);
});

it('mock exposes the same public runtime surface', () => {
  expect(Object.keys(require('../mock'))).toEqual(['useCamera']);
});
