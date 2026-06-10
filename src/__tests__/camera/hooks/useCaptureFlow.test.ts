import { renderHook, act } from '@testing-library/react-native';
import type { RefObject } from 'react';
import type { CustomPhotoFile, OpenConfig } from '../../../utils';
import type { CameraHandle } from '../../../camera/Camera';
import { useCaptureFlow } from '../../../camera/hooks/useCaptureFlow';

function makeRef(
  handle: Partial<CameraHandle>
): RefObject<CameraHandle | null> {
  return { current: handle as CameraHandle };
}

const photo = (id: string): CustomPhotoFile => ({
  id,
  cameraType: 'back',
  cameraMode: 'continuous',
  path: `/tmp/${id}.jpg`,
  uri: `file:///tmp/${id}.jpg`,
  width: 100,
  height: 100,
  mime: 'image/jpeg',
  mode: 'continuous',
});

// 连拍 + retain:不进自动预览分支、无水印 → 不依赖 burnWatermark,纯测快门编排。
const config: OpenConfig = {
  cameraMode: [{ mode: 'continuous' }],
  dataRetainedMode: 'retain',
};

function setup(capture: jest.Mock) {
  return renderHook(() =>
    useCaptureFlow({
      cameraRef: makeRef({ capture }),
      config,
      currentMode: config.cameraMode[0],
      modeIndex: 0,
      setModeIndex: jest.fn(),
      settle: jest.fn(),
      confirm: jest.fn().mockResolvedValue(true),
    })
  );
}

// 回归:疯狂连点快门 → 多个 UHD capture + Skia 烧水印并发堆积 → 内存峰值叠加 → iOS OOM 闪退。
// 防重入(capturingRef)保证一次只处理一张,处理中后续点击被忽略。
it('连点快门防重入:处理中后续点击被忽略,capture 只调一次', async () => {
  let resolveCapture!: (f: CustomPhotoFile) => void;
  const capture = jest.fn(
    () =>
      new Promise<CustomPhotoFile>((res) => {
        resolveCapture = res;
      })
  );
  const { result } = setup(capture);

  let first!: Promise<void>;
  act(() => {
    first = result.current.onShutter();
    // 第一次仍在 capture 中 —— 疯狂连点:全部应被防重入忽略
    void result.current.onShutter();
    void result.current.onShutter();
    void result.current.onShutter();
  });
  expect(capture).toHaveBeenCalledTimes(1);
  expect(result.current.capturing).toBe(true);

  await act(async () => {
    resolveCapture(photo('p1'));
    await first;
  });
  expect(result.current.photos).toHaveLength(1);
  expect(result.current.capturing).toBe(false);
});

it('上一张处理完后快门解锁,可拍下一张', async () => {
  const capture = jest
    .fn()
    .mockResolvedValueOnce(photo('p1'))
    .mockResolvedValueOnce(photo('p2'));
  const { result } = setup(capture);

  await act(async () => {
    await result.current.onShutter();
  });
  await act(async () => {
    await result.current.onShutter();
  });
  expect(capture).toHaveBeenCalledTimes(2);
  expect(result.current.photos).toHaveLength(2);
});

it('capture 失败(settle 500)后 finally 解锁,不会卡死快门', async () => {
  const capture = jest.fn().mockResolvedValue(null);
  const { result } = setup(capture);

  await act(async () => {
    await result.current.onShutter();
  });
  expect(result.current.capturing).toBe(false);
});
