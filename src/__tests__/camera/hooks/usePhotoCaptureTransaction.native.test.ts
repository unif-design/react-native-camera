import { useLayoutEffect, type RefObject } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import type { CameraHandle } from '../../../camera/Camera';
import {
  MIN_FREEZE_MS,
  usePhotoCaptureTransaction,
} from '../../../camera/hooks/usePhotoCaptureTransaction';
import { useCameraSessionController } from '../../../camera/hooks/useCameraSessionController';
import { processPhoto } from '../../../camera/image/processPhoto';
import type { SessionControllerBridge } from '../../../camera/session/controllerBridge';
import {
  createFileRegistry,
  type FileRegistry,
} from '../../../camera/session/fileRegistry';
import type {
  CameraSessionOutcome,
  CapturedFile,
  CameraInput,
} from '../../../utils';
import { makePhotoFile } from '../../__helpers__/factories';

import NativePhotoProcessor from '../../../NativePhotoProcessor';

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

function defaultConfig(): CameraInput {
  return {
    modes: [{ mode: 'continuous', quality: 0.9 }],
    retention: 'retain',
  };
}

type SetupOptions = {
  config?: CameraInput;
  capture?: jest.Mock<Promise<CapturedFile | null>, []>;
  files?: CapturedFile[];
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
    jest.fn<Promise<CapturedFile | null>, []>().mockResolvedValue(null);
  const unlink =
    options.unlink ??
    jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
  const fileRegistry = options.registry ?? createFileRegistry(unlink);
  const initialFiles = options.files ?? [];
  initialFiles.forEach((file) => fileRegistry.register(file.path));
  const onError = jest.fn<void, [string]>();
  const onSettle = jest.fn<void, [CameraSessionOutcome]>();
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

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(NativePhotoProcessor.processPhoto).mockResolvedValue(
    JSON.stringify({
      width: 1080,
      height: 1920,
      diagnostics: {
        inputWidth: 3000,
        inputHeight: 4000,
        outputWidth: 1080,
        outputHeight: 1920,
        sampled: true,
        durationMs: 1,
      },
    })
  );
});
afterEach(() => jest.useRealTimers());
it.each([{ modes: [] }, { modes: [{ mode: 'video' as const }] }])(
  'nonphoto snapshots cannot open capture work',
  async ({ modes }) => {
    const h = setup({ config: { modes, retention: 'retain' } });
    await act(async () => h.result.current.capturePhoto());
    expect(h.capture).not.toHaveBeenCalled();
  }
);
it('duplicate photo-captured event cannot commit the same native raw result twice', async () => {
  const pending = deferred<CapturedFile | null>();
  const raw = makePhotoFile({ path: '/duplicate.jpg' });
  const h = setup({ capture: jest.fn(() => pending.promise) });
  let work!: Promise<void>;
  act(() => {
    work = h.result.current.capturePhoto();
  });
  const token = {
    sessionId: 41,
    operationId: h.result.current.controller.state.operationId!,
  };
  act(() => {
    expect(h.result.current.controller.photoCaptured(token)).toBe(true);
  });
  await act(async () => {
    pending.resolve(raw);
    await work;
  });
  expect(h.unlink).toHaveBeenCalledWith(raw.path);
  expect(h.result.current.controller.state.files).toEqual([]);
});
it('real native processing failure delegates raw/output cleanup exactly once and returns ready', async () => {
  const raw = makePhotoFile({ path: '/raw.jpg', width: 3000, height: 4000 });
  jest
    .mocked(NativePhotoProcessor.processPhoto)
    .mockRejectedValueOnce(new Error('native write failed'));
  const h = setup({ capture: jest.fn().mockResolvedValue(raw) });
  await act(async () => h.result.current.capturePhoto());
  expect(h.result.current.controller.state.phase).toBe('ready');
  expect(h.onError).toHaveBeenCalledWith('照片处理失败,请重试');
  expect(h.unlink).toHaveBeenCalledTimes(2);
  expect(h.fileRegistry.stateOf(raw.path)).toBe('deleted');
  expect(h.result.current.freezeUri).toBeNull();
});
it('real processor wraps a failed currency callback and deletes the registered raw', async () => {
  const raw = makePhotoFile({ path: '/currency.jpg' });
  const failure = new Error('owner detached');
  const unlink = jest.fn().mockResolvedValue(undefined);
  const registry = createFileRegistry(unlink);
  registry.register(raw.path);
  await expect(
    processPhoto(
      raw,
      {
        sessionId: 41,
        captureId: 2,
        aspectRatio: '4:3',
        mode: {},
        cameraPosition: 'back',
      },
      registry,
      {
        isCurrent: () => {
          throw failure;
        },
      }
    )
  ).rejects.toMatchObject({ stage: 'read', cause: failure });
  expect(unlink).toHaveBeenCalledWith(raw.path);
  expect(NativePhotoProcessor.processPhoto).not.toHaveBeenCalled();
});
it('watermark freeze waits only its remaining minimum and unmount deletes both files', async () => {
  jest.useFakeTimers();
  const raw = makePhotoFile({
    path: '/watermark.jpg',
    width: 3000,
    height: 4000,
  });
  const h = setup({
    capture: jest.fn().mockResolvedValue(raw),
    config: {
      modes: [{ mode: 'continuous' }],
      retention: 'retain',
      watermark: { lines: ['evidence'], position: 'top-left' },
    },
  });
  let work!: Promise<void>;
  await act(async () => {
    work = h.result.current.capturePhoto();
    await flushMicrotasks();
  });
  expect(h.result.current.freezeUri).toBe(raw.uri);
  h.unmount();
  await act(async () => {
    jest.advanceTimersByTime(MIN_FREEZE_MS);
    await work;
  });
  expect(h.unlink).toHaveBeenCalledTimes(2);
  expect(h.onError).not.toHaveBeenCalled();
});

it('a capture rejection after teardown cannot report a stale error', async () => {
  const pending = deferred<CapturedFile | null>();
  const h = setup({ capture: jest.fn(() => pending.promise) });
  let work!: Promise<void>;
  act(() => {
    work = h.result.current.capturePhoto();
  });
  h.unmount();
  await act(async () => {
    pending.reject(new Error('late native'));
    await work;
  });
  expect(h.onError).not.toHaveBeenCalled();
});
it('slow native watermark work already satisfies the freeze minimum with an omitted position', async () => {
  jest.useFakeTimers();
  const pending = deferred<string>();
  jest
    .mocked(NativePhotoProcessor.processPhoto)
    .mockReturnValueOnce(pending.promise);
  const h = setup({
    capture: jest
      .fn()
      .mockResolvedValue(makePhotoFile({ width: 3000, height: 4000 })),
    config: {
      modes: [{ mode: 'continuous' }],
      retention: 'retain',
      watermark: { lines: ['evidence'] },
    },
  });
  let work!: Promise<void>;
  await act(async () => {
    work = h.result.current.capturePhoto();
    await flushMicrotasks();
  });
  await act(async () => {
    jest.advanceTimersByTime(2000);
    pending.resolve(
      JSON.stringify({
        width: 1440,
        height: 1920,
        diagnostics: {
          inputWidth: 3000,
          inputHeight: 4000,
          outputWidth: 1440,
          outputHeight: 1920,
          sampled: true,
          durationMs: 2000,
        },
      })
    );
    await work;
  });
  expect(h.result.current.freezeUri).toBeNull();
  expect(h.result.current.controller.state.files).toHaveLength(1);
});
it('a failed freeze scheduler cleans both processed output and raw', async () => {
  const actual = global.setTimeout;
  const timer = jest.spyOn(global, 'setTimeout').mockImplementation(((
    callback: () => void,
    delay?: number
  ) => {
    if (delay === MIN_FREEZE_MS) throw new Error('timer unavailable');
    return actual(callback, delay);
  }) as typeof setTimeout);
  const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
  const h = setup({
    capture: jest
      .fn()
      .mockResolvedValue(makePhotoFile({ width: 3000, height: 4000 })),
    config: {
      modes: [{ mode: 'continuous' }],
      retention: 'retain',
      watermark: { lines: ['evidence'] },
    },
  });
  await act(async () => h.result.current.capturePhoto());
  expect(h.unlink).toHaveBeenCalledTimes(2);
  expect(h.onError).toHaveBeenCalledWith('照片处理失败,请重试');
  timer.mockRestore();
  now.mockRestore();
});

it('processor cleanup consumes an injected registry extension failure after real file deletion', async () => {
  const raw = makePhotoFile({ path: '/extension.jpg' });
  const unlink = jest.fn().mockResolvedValue(undefined);
  const base = createFileRegistry(unlink);
  base.register(raw.path);
  const registry = {
    ...base,
    delete: async (path: string) => {
      await base.delete(path);
      throw new Error('consumer persistence failed');
    },
  };
  await expect(
    processPhoto(
      raw,
      {
        sessionId: 41,
        captureId: 9,
        aspectRatio: '4:3',
        mode: {},
        cameraPosition: 'back',
      },
      registry,
      { isCurrent: () => false }
    )
  ).rejects.toMatchObject({ stage: 'read' });
  expect(base.stateOf(raw.path)).toBe('deleted');
  expect(unlink).toHaveBeenCalledTimes(1);
});
