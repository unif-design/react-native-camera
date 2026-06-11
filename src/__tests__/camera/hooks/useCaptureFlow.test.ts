import { renderHook, act } from '@testing-library/react-native';
import type { RefObject } from 'react';
import type { CustomPhotoFile, OpenConfig } from '../../../utils';
import type { AspectRatio } from '../../../camera/setup';
import type { CameraHandle } from '../../../camera/Camera';
import {
  useCaptureFlow,
  MIN_FREEZE_MS,
} from '../../../camera/hooks/useCaptureFlow';
import { cropToRatio, burnWatermark } from '../../../camera/watermark';
import { makePhotoFile } from '../../__helpers__/factories';

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

const photo = (id: string): CustomPhotoFile =>
  makePhotoFile({
    id,
    mode: 'continuous',
    path: `/tmp/${id}.jpg`,
    uri: `file:///tmp/${id}.jpg`,
    width: 100,
    height: 100,
  });

// 连拍 + retain:不进自动预览分支、无水印 → 不依赖 burnWatermark,纯测快门编排。
const config: OpenConfig = {
  cameraMode: [{ mode: 'continuous' }],
  dataRetainedMode: 'retain',
};

// 默认 aspectRatio='4:3'(不裁切),让既有快门编排用例不受 16:9 裁切影响。
function setup(
  capture: jest.Mock,
  opts: {
    aspectRatio?: AspectRatio;
    config?: OpenConfig;
    settle?: jest.Mock;
    onError?: jest.Mock;
  } = {}
) {
  const cfg = opts.config ?? config;
  const settle = opts.settle ?? jest.fn();
  const onError = opts.onError ?? jest.fn();
  const utils = renderHook(() =>
    useCaptureFlow({
      cameraRef: makeRef({ capture }),
      config: cfg,
      currentMode: cfg.cameraMode[0],
      aspectRatio: opts.aspectRatio ?? '4:3',
      modeIndex: 0,
      setModeIndex: jest.fn(),
      settle,
      confirm: jest.fn().mockResolvedValue(true),
      onError,
    })
  );
  return { ...utils, settle, onError };
}

// 录像编排测试:video 模式不依赖 capture,直接桩 startVideo/stopVideo。
function setupVideo(
  handle: Partial<CameraHandle>,
  opts: { settle?: jest.Mock; onError?: jest.Mock } = {}
) {
  const settle = opts.settle ?? jest.fn();
  const onError = opts.onError ?? jest.fn();
  const cfg: OpenConfig = {
    cameraMode: [{ mode: 'video' }],
    dataRetainedMode: 'retain',
  };
  const utils = renderHook(() =>
    useCaptureFlow({
      cameraRef: makeRef(handle),
      config: cfg,
      currentMode: cfg.cameraMode[0],
      aspectRatio: '4:3',
      modeIndex: 0,
      setModeIndex: jest.fn(),
      settle,
      confirm: jest.fn().mockResolvedValue(true),
      onError,
    })
  );
  return { ...utils, settle, onError };
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
    // 第一次仍在 capture 中 —— 疯狂连点:后 3 次 fire-and-forget(故意不 await),全部应被防重入忽略。
    result.current.onShutter();
    result.current.onShutter();
    result.current.onShutter();
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

it('capture 失败 → 弹错误条重试,不 settle、不关相机,finally 解锁', async () => {
  const capture = jest.fn().mockResolvedValue(null);
  const { result, settle, onError } = setup(capture);

  await act(async () => {
    await result.current.onShutter();
  });
  expect(onError).toHaveBeenCalledTimes(1);
  expect(settle).not.toHaveBeenCalled();
  expect(result.current.capturing).toBe(false);
  expect(result.current.photos).toHaveLength(0);
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

describe('录像失败处理(不关相机)', () => {
  it('录像启动失败 → 弹错误条,不 settle、不进录制态', async () => {
    const startVideo = jest.fn().mockRejectedValue(new Error('boom'));
    const { result, settle, onError } = setupVideo({ startVideo });
    await act(async () => {
      await result.current.onShutter();
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(settle).not.toHaveBeenCalled();
    expect(result.current.recording).toBe(false);
  });

  it('录像停止失败(stopVideo null)→ 弹错误条,不再 settle 503', async () => {
    const startVideo = jest.fn().mockResolvedValue(undefined);
    const stopVideo = jest.fn().mockResolvedValue(null);
    const { result, settle, onError } = setupVideo({ startVideo, stopVideo });
    // 第一拍:开始录制(成功)。
    await act(async () => {
      await result.current.onShutter();
    });
    expect(result.current.recording).toBe(true);
    // 第二拍:停止 → null → 弹错误条,不 settle 关相机。
    await act(async () => {
      await result.current.onShutter();
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(settle).not.toHaveBeenCalled();
  });

  it('onVideoAutoFinished:自发结束的视频入 photos + 复位录制态,不 settle', async () => {
    const startVideo = jest.fn().mockResolvedValue(undefined);
    const { result, settle } = setupVideo({ startVideo });
    // 先开始录制。
    await act(async () => {
      await result.current.onShutter();
    });
    expect(result.current.recording).toBe(true);
    // 原生侧到点自动停(maxDuration)/磁盘满 → 自发结束回调:文件入 photos、复位录制态。
    const vid = photo('v1');
    act(() => {
      result.current.onVideoAutoFinished(vid);
    });
    expect(result.current.photos).toContain(vid);
    expect(result.current.recording).toBe(false);
    expect(settle).not.toHaveBeenCalled();
  });
});

describe('在途快门禁用保存(防丢拍)', () => {
  it('handleSave 在 capturing 时被守卫挡下,不 settle', async () => {
    let resolveCapture!: (f: CustomPhotoFile) => void;
    const capture = jest.fn(
      () =>
        new Promise<CustomPhotoFile>((res) => {
          resolveCapture = res;
        })
    );
    const { result, settle } = setup(capture);
    let shutter!: Promise<void>;
    act(() => {
      shutter = result.current.onShutter(); // 进入在途(capturing=true)
    });
    expect(result.current.capturing).toBe(true);
    act(() => {
      result.current.handleSave(); // 在途调保存 → 被 capturingRef 守卫挡下
    });
    expect(settle).not.toHaveBeenCalled(); // 不会 settle 丢掉在途那张
    await act(async () => {
      resolveCapture(photo('p1'));
      await shutter;
    });
  });
});

describe('定格回看 freezeUri', () => {
  it('烧水印期间 freezeUri = 刚拍 uri;烧完后清回 null', async () => {
    // crop 挂起 → 停在 burning 态断言 freezeUri;再 resolve 走完(含最小定格时长)断言清空。
    let resolveCrop!: (f: CustomPhotoFile) => void;
    cropToRatioMock.mockImplementationOnce(
      () =>
        new Promise<CustomPhotoFile>((res) => {
          resolveCrop = res;
        })
    );
    const captured = photo('p1'); // uri = file:///tmp/p1.jpg
    const capture = jest.fn().mockResolvedValue(captured);
    const { result } = setup(capture, { aspectRatio: '16:9' });

    let shutter!: Promise<void>;
    await act(async () => {
      shutter = result.current.onShutter();
      await Promise.resolve(); // 让 capture 跑完、进入裁切(cropToRatio 此刻挂起)
    });
    expect(result.current.burning).toBe(true);
    expect(result.current.freezeUri).toBe(captured.uri);

    await act(async () => {
      resolveCrop(captured);
      await shutter; // 含 MIN_FREEZE_MS 最小定格(真实约 200ms)
    });
    expect(result.current.burning).toBe(false);
    expect(result.current.freezeUri).toBeNull();
  });

  it('无裁切无水印 → 不进定格(freezeUri 始终 null)', async () => {
    const capture = jest.fn().mockResolvedValue(photo('p1'));
    const { result } = setup(capture, { aspectRatio: '4:3' }); // 4:3 不裁、默认无水印
    await act(async () => {
      await result.current.onShutter();
    });
    expect(result.current.freezeUri).toBeNull();
    expect(result.current.photos).toHaveLength(1);
  });

  it('无水印纯裁切:不套 MIN_FREEZE_MS,onShutter 快速完成', async () => {
    // 16:9 无水印 = 纯裁切:cropToRatio 很快,不该被 200ms 最小定格人为拉长(用户反馈)。
    const capture = jest.fn().mockResolvedValue(photo('p1'));
    const { result } = setup(capture, { aspectRatio: '16:9' });
    const t0 = Date.now();
    await act(async () => {
      await result.current.onShutter();
    });
    expect(Date.now() - t0).toBeLessThan(100); // 没套最小定格(改前会 ≥200ms)
    expect(result.current.freezeUri).toBeNull();
    expect(result.current.photos).toHaveLength(1);
  });

  it('有水印:套 MIN_FREEZE_MS,定格至少持续到最小时长', async () => {
    // 有水印才补足最小定格(防极快烧录闪烁):4:3 + 水印 = 纯烧水印(mock 立即 resolve → 耗时≈200ms)。
    const wmConfig: OpenConfig = {
      cameraMode: [{ mode: 'continuous' }],
      dataRetainedMode: 'retain',
      watermark: { content: ['L1'], position: 'top-right' },
    };
    const capture = jest.fn().mockResolvedValue(photo('p1'));
    const { result } = setup(capture, { aspectRatio: '4:3', config: wmConfig });
    const t0 = Date.now();
    await act(async () => {
      await result.current.onShutter();
    });
    expect(Date.now() - t0).toBeGreaterThanOrEqual(MIN_FREEZE_MS - 50); // 套了最小定格(留抖动余量)
    expect(result.current.freezeUri).toBeNull();
  });
});
