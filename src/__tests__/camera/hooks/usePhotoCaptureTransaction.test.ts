import { useLayoutEffect, type RefObject } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import type { CameraHandle } from '../../../camera/Camera';
import {
  MIN_FREEZE_MS,
  usePhotoCaptureTransaction,
} from '../../../camera/hooks/usePhotoCaptureTransaction';
import { useCameraSessionController } from '../../../camera/hooks/useCameraSessionController';
import {
  PhotoProcessingError,
  processPhoto,
} from '../../../camera/image/processPhoto';
import type { SessionControllerBridge } from '../../../camera/session/controllerBridge';
import {
  createFileRegistry,
  type FileRegistry,
} from '../../../camera/session/fileRegistry';
import type { CameraResult, CustomPhotoFile, OpenConfig } from '../../../utils';
import { makePhotoFile } from '../../__helpers__/factories';

jest.mock('../../../camera/image/processPhoto', () => {
  const actual = jest.requireActual('../../../camera/image/processPhoto');
  return {
    ...actual,
    processPhoto: jest.fn(),
  };
});

const processPhotoMock = processPhoto as jest.MockedFunction<
  typeof processPhoto
>;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(rounds = 6): Promise<void> {
  for (let index = 0; index < rounds; index += 1) {
    await Promise.resolve();
  }
}

function defaultConfig(): OpenConfig {
  return {
    cameraMode: [{ mode: 'continuous', quality: 0.9 }],
    dataRetainedMode: 'retain',
  };
}

type SetupOptions = {
  config?: OpenConfig;
  capture?: jest.Mock<Promise<CustomPhotoFile | null>, []>;
  files?: CustomPhotoFile[];
  aspectRatio?: '4:3' | '16:9';
  activePosition?: 'back' | 'front';
  registry?: FileRegistry;
  unlink?: jest.Mock<Promise<void>, [string]>;
  onFreezeCommit?: (uri: string | null) => void;
  onLayoutUnmount?: () => void;
};

function setup(options: SetupOptions = {}) {
  const config = options.config ?? defaultConfig();
  const capture =
    options.capture ??
    jest.fn<Promise<CustomPhotoFile | null>, []>().mockResolvedValue(null);
  const unlink =
    options.unlink ??
    jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
  const fileRegistry = options.registry ?? createFileRegistry(unlink);
  const initialFiles = options.files ?? [];
  initialFiles.forEach((file) => fileRegistry.register(file.path));
  const onError = jest.fn<void, [string]>();
  const onSettle = jest.fn<void, [CameraResult]>();
  const registerController = jest.fn(
    (_sessionId: number, _bridge: SessionControllerBridge) => jest.fn()
  );
  const cameraRef = {
    current: {
      capture,
      startVideo: jest.fn(),
      stopVideo: jest.fn(),
      cancelVideo: jest.fn(),
      getRecordedDuration: jest.fn(() => 0),
    } as unknown as CameraHandle,
  } as RefObject<CameraHandle | null>;

  const hook = renderHook(() => {
    const controller = useCameraSessionController({
      sessionId: 41,
      initialState: {
        files: initialFiles,
        modeIndex: 0,
        aspectRatio: options.aspectRatio ?? '4:3',
        activePosition: options.activePosition ?? 'back',
        canFlip: true,
        flash: 'off',
        sound: false,
        nativeConfigurationKey: 'device=back-1|output=photo',
      },
      registerController,
      confirm: jest.fn().mockResolvedValue(true),
      cancelRecording: jest.fn(),
      onSettle,
    });
    const transaction = usePhotoCaptureTransaction({
      sessionId: 41,
      cameraRef,
      controller,
      fileRegistry,
      config,
      onError,
    });
    // React 逆序执行同组件的 layout cleanup；故意声明在 transaction hook 之后，
    // 先制造 late processor cleanup，再让 transaction 接管 pending paths。
    useLayoutEffect(
      () => () => {
        options.onLayoutUnmount?.();
      },
      []
    );
    useLayoutEffect(() => {
      options.onFreezeCommit?.(transaction.freezeUri);
    }, [transaction.freezeUri]);
    return { controller, ...transaction };
  });

  act(() => {
    expect(
      hook.result.current.controller.configured(
        hook.result.current.controller.state.configurationGeneration
      )
    ).toBe(true);
  });

  return {
    ...hook,
    config,
    capture,
    unlink,
    fileRegistry,
    onError,
    onSettle,
  };
}

function processedResult(
  final: CustomPhotoFile
): jest.MockedFunction<typeof processPhoto> {
  return processPhotoMock.mockImplementation(
    async (_raw, _operation, registry) => {
      registry.register(final.path);
      return final;
    }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  processPhotoMock.mockImplementation(async (raw) => raw);
});

afterEach(() => {
  jest.useRealTimers();
});

it('同一 call stack 四次快门只启动一个 capture transaction', async () => {
  const pending = deferred<CustomPhotoFile | null>();
  const raw = makePhotoFile({
    id: 'raw',
    path: '/raw.jpg',
    width: 1440,
    height: 1920,
  });
  const harness = setup({
    capture: jest.fn(() => pending.promise),
  });
  let shutters: Promise<void>[] = [];

  act(() => {
    shutters = [
      harness.result.current.capturePhoto(),
      harness.result.current.capturePhoto(),
      harness.result.current.capturePhoto(),
      harness.result.current.capturePhoto(),
    ];
  });

  expect(harness.capture).toHaveBeenCalledTimes(1);
  expect(harness.result.current.photoBusy).toBe(true);

  await act(async () => {
    pending.resolve(raw);
    await Promise.all(shutters);
  });

  expect(harness.result.current.controller.state.files).toEqual([
    expect.objectContaining({ path: raw.path, mode: 'continuous' }),
  ]);
  expect(harness.result.current.flashNonce).toBe(1);
  expect(harness.result.current.photoBusy).toBe(false);
});

it.each([
  {
    name: 'null',
    capture: jest
      .fn<Promise<CustomPhotoFile | null>, []>()
      .mockResolvedValue(null),
  },
  {
    name: 'reject',
    capture: jest
      .fn<Promise<CustomPhotoFile | null>, []>()
      .mockRejectedValue(new Error('native capture failed')),
  },
])('capture $name 仅恢复 ready 并提示一次中文错误', async ({ capture }) => {
  const harness = setup({ capture });

  await act(async () => {
    await harness.result.current.capturePhoto();
  });

  expect(harness.result.current.controller.state).toMatchObject({
    phase: 'ready',
    files: [],
  });
  expect(harness.onError).toHaveBeenCalledTimes(1);
  expect(harness.onError).toHaveBeenCalledWith('拍摄失败,请重试');
  expect(processPhotoMock).not.toHaveBeenCalled();
});

it('capture 晚到时先登记 raw 再按 stale token 删除，不触发视觉或错误', async () => {
  const pending = deferred<CustomPhotoFile | null>();
  const raw = makePhotoFile({ id: 'late-raw', path: '/late-raw.jpg' });
  const harness = setup({ capture: jest.fn(() => pending.promise) });
  let shutter!: Promise<void>;

  act(() => {
    shutter = harness.result.current.capturePhoto();
    harness.result.current.controller.forceTeardown();
  });
  await act(async () => {
    pending.resolve(raw);
    await shutter;
  });

  expect(harness.fileRegistry.stateOf(raw.path)).toBe('deleted');
  expect(harness.unlink).toHaveBeenCalledTimes(1);
  expect(harness.result.current.flashNonce).toBe(0);
  expect(harness.result.current.burning).toBe(false);
  expect(harness.result.current.freezeUri).toBeNull();
  expect(harness.onError).not.toHaveBeenCalled();
  expect(processPhotoMock).not.toHaveBeenCalled();
});

it('unmount 后 capture 晚到只回收 raw，不做 React late update', async () => {
  const pending = deferred<CustomPhotoFile | null>();
  const raw = makePhotoFile({ id: 'unmounted-raw', path: '/unmounted.jpg' });
  const harness = setup({ capture: jest.fn(() => pending.promise) });
  let shutter!: Promise<void>;

  act(() => {
    shutter = harness.result.current.capturePhoto();
    harness.unmount();
  });
  await act(async () => {
    pending.resolve(raw);
    await shutter;
  });

  expect(harness.fileRegistry.stateOf(raw.path)).toBe('deleted');
  expect(harness.unlink).toHaveBeenCalledWith(raw.path);
  expect(harness.onError).not.toHaveBeenCalled();
});

it('processor 晚到时登记 final 后回收 raw/final，不提交文件或晚到视觉更新', async () => {
  const pending = deferred<CustomPhotoFile>();
  const raw = makePhotoFile({ id: 'raw', path: '/raw.jpg' });
  const final = makePhotoFile({ id: 'final', path: '/final.jpg' });
  processPhotoMock.mockImplementation((_raw, _operation, registry) =>
    pending.promise.then((file) => {
      registry.register(file.path);
      return file;
    })
  );
  const harness = setup({
    aspectRatio: '16:9',
    capture: jest.fn().mockResolvedValue(raw),
  });
  let shutter!: Promise<void>;

  await act(async () => {
    shutter = harness.result.current.capturePhoto();
    await flushMicrotasks();
  });
  expect(harness.result.current.flashNonce).toBe(1);
  expect(harness.result.current.burning).toBe(true);
  expect(harness.result.current.freezeUri).toBe(raw.uri);

  act(() => {
    harness.result.current.controller.forceTeardown();
  });
  await act(async () => {
    pending.resolve(final);
    await shutter;
  });

  expect(harness.fileRegistry.stateOf(raw.path)).toBe('deleted');
  expect(harness.fileRegistry.stateOf(final.path)).toBe('deleted');
  expect(harness.result.current.controller.state.files).toEqual([]);
  expect(harness.result.current.burning).toBe(false);
  expect(harness.result.current.freezeUri).toBeNull();
  expect(harness.onError).not.toHaveBeenCalled();
});

it('watermark freeze timer 晚到后重复 gate，stale 时只清理产物', async () => {
  jest.useFakeTimers();
  const raw = makePhotoFile({ id: 'raw', path: '/raw.jpg' });
  const final = makePhotoFile({ id: 'final', path: '/final.jpg' });
  processedResult(final);
  const harness = setup({
    config: {
      cameraMode: [{ mode: 'continuous' }],
      dataRetainedMode: 'retain',
      watermark: { content: ['可见水印'], position: 'top-right' },
    },
    capture: jest.fn().mockResolvedValue(raw),
  });
  let shutter!: Promise<void>;

  await act(async () => {
    shutter = harness.result.current.capturePhoto();
    await flushMicrotasks();
  });
  expect(jest.getTimerCount()).toBeGreaterThanOrEqual(1);
  expect(harness.result.current.burning).toBe(false);
  expect(harness.result.current.freezeUri).toBe(raw.uri);

  act(() => {
    harness.result.current.controller.forceTeardown();
  });
  await act(async () => {
    jest.advanceTimersByTime(MIN_FREEZE_MS);
    await shutter;
  });

  expect(harness.fileRegistry.stateOf(raw.path)).toBe('deleted');
  expect(harness.fileRegistry.stateOf(final.path)).toBe('deleted');
  expect(harness.result.current.controller.state.files).toEqual([]);
  expect(harness.result.current.freezeUri).toBeNull();
  expect(harness.onError).not.toHaveBeenCalled();
});

it('首个 await 前深快照 mode/aspect/watermark/actual position 并以 operationId 作 captureId', async () => {
  jest.useFakeTimers();
  const pending = deferred<CustomPhotoFile | null>();
  const raw = makePhotoFile({
    id: 'raw',
    path: '/raw.jpg',
    cameraType: 'back',
    cameraMode: 'single',
    mode: 'single',
  });
  const final = makePhotoFile({ id: 'final', path: '/final.jpg' });
  const config: OpenConfig = {
    cameraMode: [{ mode: 'continuous', quality: 0.77 }],
    dataRetainedMode: 'retain',
    watermark: { content: ['原始水印'], position: 'bottom-right' },
  };
  processedResult(final);
  const harness = setup({
    config,
    aspectRatio: '16:9',
    activePosition: 'front',
    capture: jest.fn(() => pending.promise),
  });
  let shutter!: Promise<void>;

  act(() => {
    shutter = harness.result.current.capturePhoto();
  });
  config.cameraMode[0]!.mode = 'video';
  config.cameraMode[0]!.quality = 0.1;
  config.watermark!.content[0] = '变化后水印';
  config.watermark!.position = 'top-left';
  harness.result.current.controller.state.aspectRatio = '4:3';
  harness.result.current.controller.state.activePosition = 'back';

  await act(async () => {
    pending.resolve(raw);
    await flushMicrotasks();
  });

  expect(processPhotoMock).toHaveBeenCalledWith(
    expect.objectContaining({
      cameraType: 'front',
      cameraMode: 'continuous',
      mode: 'continuous',
    }),
    {
      sessionId: 41,
      captureId: 1,
      aspectRatio: '16:9',
      mode: { quality: 0.77 },
      watermark: {
        content: ['原始水印'],
        position: 'bottom-right',
      },
      cameraPosition: 'front',
    },
    harness.fileRegistry,
    expect.objectContaining({ isCurrent: expect.any(Function) })
  );

  await act(async () => {
    jest.advanceTimersByTime(MIN_FREEZE_MS);
    await shutter;
  });
});

it('处理失败保留旧文件、回收 raw，并只提示一次照片处理错误', async () => {
  const old = makePhotoFile({ id: 'old', path: '/old.jpg' });
  const raw = makePhotoFile({ id: 'raw', path: '/raw.jpg' });
  processPhotoMock.mockRejectedValue(
    new PhotoProcessingError('encode', new Error('encode failed'))
  );
  const harness = setup({
    files: [old],
    aspectRatio: '16:9',
    capture: jest.fn().mockResolvedValue(raw),
  });

  await act(async () => {
    await harness.result.current.capturePhoto();
  });

  expect(harness.result.current.controller.state).toMatchObject({
    phase: 'ready',
    files: [old],
  });
  expect(harness.fileRegistry.stateOf(old.path)).toBe('owned');
  expect(harness.fileRegistry.stateOf(raw.path)).toBe('deleted');
  expect(harness.onError).toHaveBeenCalledTimes(1);
  expect(harness.onError).toHaveBeenCalledWith('照片处理失败,请重试');
  expect(harness.result.current.burning).toBe(false);
  expect(harness.result.current.freezeUri).toBeNull();
});

it('mock processor reject 先提交撤 freeze render，再 fallback 清理 raw', async () => {
  const raw = makePhotoFile({ id: 'raw', path: '/raw.jpg' });
  const processing = deferred<CustomPhotoFile>();
  const base = createFileRegistry(jest.fn(async () => {}));
  const freezeAtDelete: Array<string | null> = [];
  let committedFreeze: string | null = null;
  const registry: FileRegistry = {
    ...base,
    delete: jest.fn((path: string) => {
      freezeAtDelete.push(committedFreeze);
      return base.delete(path);
    }),
  };
  processPhotoMock.mockImplementation(() => processing.promise);
  const harness = setup({
    aspectRatio: '16:9',
    capture: jest.fn().mockResolvedValue(raw),
    registry,
    onFreezeCommit: (uri) => {
      committedFreeze = uri;
    },
  });
  let shutter!: Promise<void>;

  await act(async () => {
    shutter = harness.result.current.capturePhoto();
    await flushMicrotasks();
  });
  expect(harness.result.current.freezeUri).toBe(raw.uri);

  await act(async () => {
    processing.reject(new PhotoProcessingError('encode'));
    await shutter;
  });

  expect(freezeAtDelete).toEqual([null]);
  expect(harness.fileRegistry.stateOf(raw.path)).toBe('deleted');
  expect(harness.result.current.freezeUri).toBeNull();
});

it('processor delegate 的 raw/partial final 在撤 freeze 后各清理一次', async () => {
  const raw = makePhotoFile({ id: 'raw', path: '/raw.jpg' });
  const partialPath = '/partial.jpg';
  const unlink = jest
    .fn<Promise<void>, [string]>()
    .mockResolvedValue(undefined);
  const registry = createFileRegistry(unlink);
  processPhotoMock.mockImplementation(
    async (receivedRaw, _operation, receivedRegistry, context) => {
      receivedRegistry.register(partialPath);
      const cleanupContext = context as typeof context & {
        onCleanupRequired?: (paths: readonly string[]) => void;
      };
      cleanupContext?.onCleanupRequired?.([receivedRaw.path, partialPath]);
      throw new PhotoProcessingError('write');
    }
  );
  const harness = setup({
    aspectRatio: '16:9',
    capture: jest.fn().mockResolvedValue(raw),
    registry,
  });

  await act(async () => {
    await harness.result.current.capturePhoto();
  });

  expect(harness.result.current.freezeUri).toBeNull();
  expect(registry.stateOf(raw.path)).toBe('deleted');
  expect(registry.stateOf(partialPath)).toBe('deleted');
  expect(unlink).toHaveBeenCalledTimes(2);
  expect(unlink).toHaveBeenCalledWith(raw.path);
  expect(unlink).toHaveBeenCalledWith(partialPath);
});

it('unmount 后 processor delegate 的 raw/partial final 无视觉引用，可立即清理', async () => {
  const raw = makePhotoFile({ id: 'raw', path: '/raw.jpg' });
  const partialPath = '/partial.jpg';
  const processing = deferred<CustomPhotoFile>();
  const unlink = jest
    .fn<Promise<void>, [string]>()
    .mockResolvedValue(undefined);
  const registry = createFileRegistry(unlink);
  processPhotoMock.mockImplementation(
    (_receivedRaw, _operation, receivedRegistry, context) =>
      processing.promise.catch((error) => {
        receivedRegistry.register(partialPath);
        const cleanupContext = context as typeof context & {
          onCleanupRequired?: (paths: readonly string[]) => void;
        };
        cleanupContext?.onCleanupRequired?.([raw.path, partialPath]);
        throw error;
      })
  );
  const harness = setup({
    aspectRatio: '16:9',
    capture: jest.fn().mockResolvedValue(raw),
    registry,
  });
  let shutter!: Promise<void>;

  await act(async () => {
    shutter = harness.result.current.capturePhoto();
    await flushMicrotasks();
  });
  act(() => {
    harness.unmount();
  });
  await act(async () => {
    processing.reject(new PhotoProcessingError('write'));
    await shutter;
  });

  expect(registry.stateOf(raw.path)).toBe('deleted');
  expect(registry.stateOf(partialPath)).toBe('deleted');
  expect(unlink).toHaveBeenCalledTimes(2);
});

it('layout unmount 窗口在 session drain 后登记的 partial 会被同步接管且逐 path 幂等', async () => {
  const raw = makePhotoFile({ id: 'raw', path: '/raw.jpg' });
  const partialPath = '/partial.jpg';
  const processing = deferred<CustomPhotoFile>();
  const unlink = jest
    .fn<Promise<void>, [string]>()
    .mockResolvedValue(undefined);
  const registry = createFileRegistry(unlink);
  let onCleanupRequired: ((paths: readonly string[]) => void) | undefined;
  processPhotoMock.mockImplementation(
    (_receivedRaw, _operation, _receivedRegistry, context) => {
      onCleanupRequired = context?.onCleanupRequired;
      return processing.promise;
    }
  );
  const harness = setup({
    aspectRatio: '16:9',
    capture: jest.fn().mockResolvedValue(raw),
    registry,
    onLayoutUnmount: () => {
      // 复刻 host removal 已触发 session drain，但 processor 随后才登记 partial。
      registry.drain().catch(() => {
        // 测试 unlink 固定成功；保留兜底以免自定义 registry 形成未处理 rejection。
      });
      registry.register(partialPath);
      if (onCleanupRequired == null) {
        throw new Error('processor cleanup delegate was not installed');
      }
      onCleanupRequired([raw.path, partialPath]);
    },
  });
  let shutter!: Promise<void>;

  await act(async () => {
    shutter = harness.result.current.capturePhoto();
    await flushMicrotasks();
  });
  expect(harness.result.current.freezeUri).toBe(raw.uri);

  act(() => {
    harness.unmount();
  });
  const partialStateAfterLayoutUnmount = registry.stateOf(partialPath);

  await act(async () => {
    processing.reject(new PhotoProcessingError('write'));
    await shutter;
  });

  expect(partialStateAfterLayoutUnmount).toBe('deleted');
  expect(registry.stateOf(raw.path)).toBe('deleted');
  expect(registry.stateOf(partialPath)).toBe('deleted');
  expect(unlink).toHaveBeenCalledTimes(2);
  expect(unlink).toHaveBeenCalledWith(raw.path);
  expect(unlink).toHaveBeenCalledWith(partialPath);
});

it('raw 在 processor 前已登记，final 返回后再次登记再通过 token gate', async () => {
  const raw = makePhotoFile({ id: 'raw', path: '/raw.jpg' });
  const final = makePhotoFile({ id: 'final', path: '/final.jpg' });
  const base = createFileRegistry(jest.fn(async () => {}));
  const register = jest.fn(base.register);
  const registry: FileRegistry = {
    ...base,
    register,
  };
  processPhotoMock.mockImplementation(
    async (receivedRaw, _operation, receivedRegistry) => {
      expect(receivedRegistry.stateOf(receivedRaw.path)).toBe('owned');
      receivedRegistry.register(final.path);
      return final;
    }
  );
  const harness = setup({
    aspectRatio: '16:9',
    capture: jest.fn().mockResolvedValue(raw),
    registry,
  });

  await act(async () => {
    await harness.result.current.capturePhoto();
  });

  expect(register.mock.calls).toEqual([[raw.path], [final.path], [final.path]]);
  expect(harness.result.current.controller.state.files).toEqual([final]);
});

it('先提交 freezeUri=null 的 render，才启动 raw→final replace', async () => {
  const raw = makePhotoFile({ id: 'raw', path: '/raw.jpg' });
  const final = makePhotoFile({ id: 'final', path: '/final.jpg' });
  const base = createFileRegistry(jest.fn(async () => {}));
  let readFreeze: () => string | null = () => 'not-mounted';
  const replace = jest.fn((rawPath: string, finalPath: string) => {
    expect(readFreeze()).toBeNull();
    return base.replace(rawPath, finalPath);
  });
  const registry: FileRegistry = { ...base, replace };
  processedResult(final);
  const harness = setup({
    aspectRatio: '16:9',
    capture: jest.fn().mockResolvedValue(raw),
    registry,
  });
  readFreeze = () => harness.result.current.freezeUri;

  await act(async () => {
    await harness.result.current.capturePhoto();
  });

  expect(replace).toHaveBeenCalledTimes(1);
  expect(replace).toHaveBeenCalledWith(raw.path, final.path);
});

it('raw replace 的慢 unlink 不阻塞 capture transaction 或文件提交', async () => {
  const unlinkPending = deferred<void>();
  const unlink = jest.fn((_path: string) => unlinkPending.promise);
  const raw = makePhotoFile({ id: 'raw', path: '/raw.jpg' });
  const final = makePhotoFile({ id: 'final', path: '/final.jpg' });
  processedResult(final);
  const harness = setup({
    aspectRatio: '16:9',
    capture: jest.fn().mockResolvedValue(raw),
    unlink,
  });

  const outcome = await Promise.race([
    act(async () => {
      await harness.result.current.capturePhoto();
      return 'resolved';
    }),
    new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), 20)
    ),
  ]);
  unlinkPending.resolve();

  expect(outcome).toBe('resolved');
  expect(harness.result.current.controller.state.files).toEqual([final]);
  expect(harness.fileRegistry.stateOf(raw.path)).toBe('deleted');
  expect(harness.fileRegistry.stateOf(final.path)).toBe('owned');
});

it('deletePhoto 按实际摘除文件执行 owned cleanup', async () => {
  const first = makePhotoFile({ id: 'first', path: '/first.jpg' });
  const second = makePhotoFile({ id: 'second', path: '/second.jpg' });
  const harness = setup({ files: [first, second] });

  act(() => {
    expect(harness.result.current.openGallery()).toBe(true);
    expect(harness.result.current.deletePhoto(first)).toBe(true);
  });
  await act(flushMicrotasks);

  expect(harness.result.current.controller.state.files).toEqual([second]);
  expect(harness.fileRegistry.stateOf(first.path)).toBe('deleted');
  expect(harness.fileRegistry.stateOf(second.path)).toBe('owned');
});

it('retake 清空 preview files 并逐个执行 owned cleanup', async () => {
  const first = makePhotoFile({ id: 'first', path: '/first.jpg' });
  const second = makePhotoFile({ id: 'second', path: '/second.jpg' });
  const harness = setup({ files: [first, second] });

  act(() => {
    expect(harness.result.current.openGallery()).toBe(true);
    expect(harness.result.current.retake()).toBe(true);
  });
  await act(flushMicrotasks);

  expect(harness.result.current.controller.state).toMatchObject({
    phase: 'ready',
    files: [],
    preview: null,
  });
  expect(harness.fileRegistry.stateOf(first.path)).toBe('deleted');
  expect(harness.fileRegistry.stateOf(second.path)).toBe('deleted');
});

it('clearForModeSwitch 从 ready 清空快照并逐个执行 owned cleanup', async () => {
  const first = makePhotoFile({ id: 'first', path: '/first.jpg' });
  const second = makePhotoFile({ id: 'second', path: '/second.jpg' });
  const harness = setup({ files: [first, second] });

  act(() => {
    expect(harness.result.current.clearForModeSwitch()).toBe(true);
  });
  await act(flushMicrotasks);

  expect(harness.result.current.controller.state.files).toEqual([]);
  expect(harness.fileRegistry.stateOf(first.path)).toBe('deleted');
  expect(harness.fileRegistry.stateOf(second.path)).toBe('deleted');
});

it('save 只 settle 最新 files，不提前 transfer 或 delete', () => {
  const first = makePhotoFile({ id: 'first', path: '/first.jpg' });
  const harness = setup({ files: [first] });

  act(() => {
    expect(harness.result.current.save()).toBe(true);
  });

  expect(harness.onSettle).toHaveBeenCalledWith({
    code: 200,
    data: [first],
    message: 'ok',
  });
  expect(harness.fileRegistry.stateOf(first.path)).toBe('owned');
  expect(harness.unlink).not.toHaveBeenCalled();
});

it('video mode 不进入照片 transaction', async () => {
  const harness = setup({
    config: {
      cameraMode: [{ mode: 'video' }],
      dataRetainedMode: 'retain',
    },
  });

  await act(async () => {
    await harness.result.current.capturePhoto();
  });

  expect(harness.capture).not.toHaveBeenCalled();
  expect(harness.result.current.controller.state.phase).toBe('ready');
  expect(harness.onError).not.toHaveBeenCalled();
});
