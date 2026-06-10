import { renderHook, act } from '@testing-library/react-native';
import type { RefObject } from 'react';
import type { CustomPhotoFile, OpenConfig } from '../../../utils';
import type { AspectRatio } from '../../../camera/setup';
import type { CameraHandle } from '../../../camera/Camera';
import { useCaptureFlow } from '../../../camera/hooks/useCaptureFlow';
import { cropToRatio, burnWatermark } from '../../../camera/watermark';

// 出图 16:9 裁切 / 烧水印的接线断言:mock 掉 watermark 管线,只验证 onShutter **是否调用**
// 它们(裁切 / 烧水印的实现各有专属单测,这里不重复测内容)。默认透传 file。
jest.mock('../../../camera/watermark', () => ({
  cropToRatio: jest.fn((f: CustomPhotoFile) => Promise.resolve(f)),
  burnWatermark: jest.fn((f: CustomPhotoFile) => Promise.resolve(f)),
}));
const cropToRatioMock = jest.mocked(cropToRatio);
const burnWatermarkMock = jest.mocked(burnWatermark);

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

// 默认 aspectRatio='4:3'(不裁切),让既有快门编排用例不受 16:9 裁切影响。
function setup(
  capture: jest.Mock,
  opts: { aspectRatio?: AspectRatio; config?: OpenConfig } = {}
) {
  const cfg = opts.config ?? config;
  return renderHook(() =>
    useCaptureFlow({
      cameraRef: makeRef({ capture }),
      config: cfg,
      currentMode: cfg.cameraMode[0],
      aspectRatio: opts.aspectRatio ?? '4:3',
      modeIndex: 0,
      setModeIndex: jest.fn(),
      settle: jest.fn(),
      confirm: jest.fn().mockResolvedValue(true),
    })
  );
}

beforeEach(() => {
  cropToRatioMock.mockClear();
  burnWatermarkMock.mockClear();
});

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

describe('出图 16:9 裁切接线', () => {
  it("aspectRatio='16:9' → 拍后调 cropToRatio(f, '16:9')", async () => {
    const captured = photo('p1');
    const capture = jest.fn().mockResolvedValue(captured);
    const { result } = setup(capture, { aspectRatio: '16:9' });

    await act(async () => {
      await result.current.onShutter();
    });
    expect(cropToRatioMock).toHaveBeenCalledTimes(1);
    expect(cropToRatioMock).toHaveBeenCalledWith(captured, '16:9');
  });

  it("aspectRatio='4:3' → 不裁切(cropToRatio 不调)", async () => {
    const capture = jest.fn().mockResolvedValue(photo('p1'));
    const { result } = setup(capture, { aspectRatio: '4:3' });

    await act(async () => {
      await result.current.onShutter();
    });
    expect(cropToRatioMock).not.toHaveBeenCalled();
  });

  it('裁切期间 burning=true,处理完回落 false', async () => {
    let resolveCrop!: (f: CustomPhotoFile) => void;
    cropToRatioMock.mockImplementationOnce(
      () =>
        new Promise<CustomPhotoFile>((res) => {
          resolveCrop = res;
        })
    );
    const captured = photo('p1');
    const capture = jest.fn().mockResolvedValue(captured);
    const { result } = setup(capture, { aspectRatio: '16:9' });

    let shutter!: Promise<void>;
    await act(async () => {
      shutter = result.current.onShutter();
      // 让 capture 这一拍 microtask 跑完、进入裁切(此刻 cropToRatio 挂起)。
      await Promise.resolve();
    });
    expect(result.current.burning).toBe(true);

    await act(async () => {
      resolveCrop(captured);
      await shutter;
    });
    expect(result.current.burning).toBe(false);
    expect(result.current.photos).toHaveLength(1);
  });
});

describe('16:9 + 水印组合', () => {
  const wmConfig: OpenConfig = {
    cameraMode: [{ mode: 'continuous' }],
    dataRetainedMode: 'retain',
    watermark: { content: ['L1'], position: 'top-right' },
  };

  it('16:9 + 水印 → 先裁切后烧水印(都在裁后图上)', async () => {
    const captured = photo('p1');
    const cropped = { ...captured, width: 810, height: 1440, path: '/c.jpg' };
    cropToRatioMock.mockResolvedValueOnce(cropped);
    const capture = jest.fn().mockResolvedValue(captured);
    const { result } = setup(capture, {
      aspectRatio: '16:9',
      config: wmConfig,
    });

    await act(async () => {
      await result.current.onShutter();
    });
    expect(cropToRatioMock).toHaveBeenCalledWith(captured, '16:9');
    // 水印烧在裁切后的图上(顺序:crop → watermark)。
    expect(burnWatermarkMock).toHaveBeenCalledWith(cropped, wmConfig.watermark);
  });
});
