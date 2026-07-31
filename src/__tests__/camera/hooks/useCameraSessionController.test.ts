import { StrictMode, createElement } from 'react';
import { act, render, renderHook } from '@testing-library/react-native';
import {
  useCameraSessionController,
  type CameraOperationToken,
} from '../../../camera/hooks/useCameraSessionController';
import type { SessionControllerBridge } from '../../../camera/session/controllerBridge';
import type { CameraSessionPhase } from '../../../camera/session/types';
import type { CameraResult, CustomPhotoFile } from '../../../utils';

const photo: CustomPhotoFile = {
  id: 'photo-1',
  cameraType: 'back',
  cameraMode: 'single',
  path: '/tmp/photo-1.jpg',
  uri: 'file:///tmp/photo-1.jpg',
  width: 3024,
  height: 4032,
  mime: 'image/jpeg',
  mode: 'single',
  isRemake: false,
};

const video: CustomPhotoFile = {
  ...photo,
  id: 'video-1',
  cameraMode: 'video',
  path: '/tmp/video-1.mp4',
  uri: 'file:///tmp/video-1.mp4',
  mime: 'video/mp4',
  mode: 'video',
  duration: 12,
};

const savedResult: CameraResult = {
  code: 200,
  data: [photo],
  message: 'ok',
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type SetupOverrides = {
  files?: CustomPhotoFile[];
  confirm?: jest.Mock<Promise<boolean>, [unknown]>;
  cancelRecording?: jest.Mock<void | Promise<void>, []>;
  onSettle?: jest.Mock<void, [CameraResult]>;
  registerController?: jest.Mock<() => void, [number, SessionControllerBridge]>;
};

function setup(overrides: SetupOverrides = {}) {
  const unregister = jest.fn();
  const registerController =
    overrides.registerController ??
    jest.fn(
      (_sessionId: number, _bridge: SessionControllerBridge) => unregister
    );
  const confirm =
    overrides.confirm ??
    jest.fn<Promise<boolean>, [unknown]>().mockResolvedValue(true);
  const cancelRecording =
    overrides.cancelRecording ??
    jest.fn<void | Promise<void>, []>().mockResolvedValue(undefined);
  const onSettle = overrides.onSettle ?? jest.fn<void, [CameraResult]>();

  const hook = renderHook(() =>
    useCameraSessionController({
      sessionId: 41,
      initialState: {
        files: overrides.files ?? [],
        modeIndex: 0,
        aspectRatio: '16:9',
        activePosition: 'back',
        canFlip: true,
        flash: 'off',
        sound: false,
        nativeConfigurationKey: 'device=back-1|output=photo',
      },
      registerController,
      confirm,
      cancelRecording,
      onSettle,
    })
  );

  return {
    ...hook,
    unregister,
    registerController,
    confirm,
    cancelRecording,
    onSettle,
    bridge: () => registerController.mock.calls.at(-1)?.[1],
  };
}

function configureReady(result: ReturnType<typeof setup>['result']): void {
  let accepted = false;
  act(() => {
    accepted = result.current.configured(
      result.current.state.configurationGeneration
    );
  });
  expect(accepted).toBe(true);
  expect(result.current.state.phase).toBe('ready');
}

function beginPhoto(
  result: ReturnType<typeof setup>['result']
): CameraOperationToken {
  let token: CameraOperationToken | null = null;
  act(() => {
    token = result.current.beginPhoto();
  });
  if (token == null) throw new Error('photo operation was not accepted');
  return token;
}

function beginRecording(
  result: ReturnType<typeof setup>['result']
): CameraOperationToken {
  let token: CameraOperationToken | null = null;
  act(() => {
    token = result.current.beginVideo();
  });
  if (token == null) throw new Error('video operation was not accepted');
  act(() => {
    expect(result.current.videoStarted(token!)).toBe(true);
  });
  return token;
}

describe('useCameraSessionController', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts configuring with reducer-derived capabilities and registers its session bridge', () => {
    const { result, registerController, bridge } = setup();

    expect(result.current.state).toMatchObject({
      phase: 'configuring',
      files: [],
      operationId: null,
      configurationGeneration: 0,
    });
    expect(result.current.capabilities).toEqual({
      capture: false,
      flip: false,
      mode: false,
      aspect: false,
      save: false,
      gallery: false,
      zoom: false,
      focus: false,
      userCancel: true,
    });
    expect(registerController).toHaveBeenCalledWith(41, bridge());
  });

  it('only accepts the current configuration generation', () => {
    const { result } = setup();

    act(() => {
      expect(result.current.configured(1)).toBe(false);
      expect(result.current.configured(0)).toBe(true);
      expect(result.current.configured(0)).toBe(false);
    });

    expect(result.current.state.phase).toBe('ready');
  });

  it('keeps ready and generation stable when configuration identity is unchanged', () => {
    const { result } = setup();
    configureReady(result);

    let generation: number | null = null;
    act(() => {
      generation = result.current.beginConfiguration(
        'device=back-1|output=photo',
        { modeIndex: 1, aspectRatio: '4:3' }
      );
    });

    expect(generation).toBe(0);
    expect(result.current.state).toMatchObject({
      phase: 'ready',
      configurationGeneration: 0,
      modeIndex: 1,
      aspectRatio: '4:3',
    });
  });

  it('increments native generation and ignores an older configured callback', () => {
    const { result } = setup();
    configureReady(result);

    let firstGeneration: number | null = null;
    let secondGeneration: number | null = null;
    act(() => {
      firstGeneration = result.current.beginConfiguration(
        'device=front-1|output=photo'
      );
      secondGeneration = result.current.beginConfiguration(
        'device=front-1|output=video'
      );
    });

    expect(firstGeneration).toBe(1);
    expect(secondGeneration).toBe(2);
    expect(result.current.state).toMatchObject({
      phase: 'configuring',
      configurationGeneration: 2,
    });

    act(() => {
      expect(result.current.configured(firstGeneration!)).toBe(false);
      expect(result.current.configured(secondGeneration!)).toBe(true);
    });
    expect(result.current.state.phase).toBe('ready');
  });

  it('accepts only the first photo begin in the same call stack', () => {
    const { result } = setup();
    configureReady(result);

    let first: CameraOperationToken | null = null;
    let second: CameraOperationToken | null = null;
    act(() => {
      first = result.current.beginPhoto();
      second = result.current.beginPhoto();
    });

    expect(first).toEqual({ sessionId: 41, operationId: 1 });
    expect(second).toBeNull();
    expect(result.current.state).toMatchObject({
      phase: 'capturingPhoto',
      operationId: 1,
    });
  });

  it('accepts photo capture and processing completion once', () => {
    const { result } = setup();
    configureReady(result);
    const token = beginPhoto(result);

    act(() => {
      expect(result.current.photoCaptured(token)).toBe(true);
      expect(
        result.current.photoSucceeded(token, photo, {
          variant: 'confirm',
          index: 0,
        })
      ).toBe(true);
      expect(result.current.photoSucceeded(token, photo)).toBe(false);
    });

    expect(result.current.state).toMatchObject({
      phase: 'previewing',
      files: [photo],
      operationId: null,
      preview: { variant: 'confirm', index: 0 },
    });
  });

  it('rejects stale photo completions after failure and a new operation', () => {
    const { result } = setup();
    configureReady(result);
    const stale = beginPhoto(result);
    act(() => {
      expect(result.current.fail(stale)).toBe(true);
    });
    const current = beginPhoto(result);

    act(() => {
      expect(result.current.photoCaptured(stale)).toBe(false);
      expect(result.current.fail(stale)).toBe(false);
      expect(result.current.photoCaptured(current)).toBe(true);
    });

    expect(result.current.state).toMatchObject({
      phase: 'processingPhoto',
      operationId: current.operationId,
      files: [],
    });
  });

  it('accepts only the first video begin in the same call stack', () => {
    const { result } = setup();
    configureReady(result);

    let first: CameraOperationToken | null = null;
    let second: CameraOperationToken | null = null;
    act(() => {
      first = result.current.beginVideo();
      second = result.current.beginVideo();
    });

    expect(first).toEqual({ sessionId: 41, operationId: 1 });
    expect(second).toBeNull();
    expect(result.current.state.phase).toBe('startingVideo');
  });

  it('projects video start, progress, stop and native finish through the reducer', () => {
    const { result } = setup();
    configureReady(result);
    const token = beginRecording(result);

    act(() => {
      expect(result.current.videoProgress(token, 8)).toBe(true);
      expect(result.current.stopVideo(token, 9)).toBe(true);
      expect(
        result.current.videoFinished(token, {
          file: video,
          duration: 12,
          reason: 'completed',
        })
      ).toBe(true);
      expect(
        result.current.videoFinished(token, {
          file: video,
          duration: 12,
          reason: 'completed',
        })
      ).toBe(false);
    });

    expect(result.current.state).toMatchObject({
      phase: 'ready',
      operationId: null,
      files: [video],
      video: { duration: 12, reason: 'completed' },
    });
  });

  it('rejects a token from another session and stale video events', () => {
    const { result } = setup();
    configureReady(result);
    const token = beginRecording(result);
    const foreign = { ...token, sessionId: 42 };

    act(() => {
      expect(result.current.videoProgress(foreign, 2)).toBe(false);
      expect(result.current.fail(foreign)).toBe(false);
      expect(result.current.fail(token)).toBe(true);
      expect(result.current.videoProgress(token, 3)).toBe(false);
    });

    expect(result.current.state.phase).toBe('ready');
  });

  it('exposes reducer-backed flash, sound and preview commands', () => {
    const { result } = setup({ files: [photo] });
    configureReady(result);

    act(() => {
      expect(result.current.setFlash('auto')).toBe(true);
      expect(result.current.setSound(true)).toBe(true);
      expect(result.current.openPreview({ variant: 'gallery', index: 0 })).toBe(
        true
      );
      expect(result.current.closePreview()).toBe(true);
      expect(result.current.closePreview()).toBe(false);
    });

    expect(result.current.state).toMatchObject({
      phase: 'ready',
      flash: 'auto',
      sound: true,
      preview: null,
    });
  });

  it('force teardown invalidates video before a synchronous native terminal callback', () => {
    let controllerResult: ReturnType<typeof setup>['result'] | undefined;
    let token: CameraOperationToken | undefined;
    const cancelRecording = jest.fn(() => {
      expect(controllerResult!.current.isCurrent(token!)).toBe(false);
      expect(
        controllerResult!.current.videoFinished(token!, {
          file: video,
          duration: 4,
          reason: 'cancelled',
        })
      ).toBe(false);
    });
    const harness = setup({ cancelRecording });
    controllerResult = harness.result;
    configureReady(harness.result);
    token = beginRecording(harness.result);

    act(() => {
      harness.bridge()!.forceTeardown();
    });

    expect(harness.result.current.state).toMatchObject({
      phase: 'settling',
      files: [],
      operationId: null,
    });
    expect(cancelRecording).toHaveBeenCalledTimes(1);
    expect(harness.onSettle).not.toHaveBeenCalled();
  });

  it('force teardown is idempotent and never settles the public result', () => {
    const harness = setup();
    configureReady(harness.result);
    beginRecording(harness.result);

    act(() => {
      harness.result.current.forceTeardown();
      harness.result.current.forceTeardown();
      harness.bridge()!.forceTeardown();
    });

    expect(harness.cancelRecording).toHaveBeenCalledTimes(1);
    expect(harness.onSettle).not.toHaveBeenCalled();
    expect(harness.result.current.state.phase).toBe('settling');
  });

  it.each<CameraSessionPhase>([
    'capturingPhoto',
    'processingPhoto',
    'startingVideo',
    'stoppingVideo',
  ])('ignores user cancel in transient %s', (phase) => {
    const harness = setup();
    configureReady(harness.result);
    let token: CameraOperationToken;

    if (phase === 'capturingPhoto' || phase === 'processingPhoto') {
      token = beginPhoto(harness.result);
      if (phase === 'processingPhoto') {
        act(() => {
          harness.result.current.photoCaptured(token);
        });
      }
    } else {
      act(() => {
        token = harness.result.current.beginVideo()!;
      });
      if (phase === 'stoppingVideo') {
        act(() => {
          harness.result.current.videoStarted(token);
          harness.result.current.stopVideo(token, 1);
        });
      }
    }

    act(() => {
      harness.bridge()!.requestUserCancel();
    });

    expect(harness.result.current.state.phase).toBe(phase);
    expect(harness.confirm).not.toHaveBeenCalled();
    expect(harness.onSettle).not.toHaveBeenCalled();
  });

  it.each(['configuring', 'ready'] as const)(
    'settles cancellation immediately from %s when there are no files',
    (phase) => {
      const harness = setup();
      if (phase === 'ready') configureReady(harness.result);

      act(() => {
        harness.result.current.requestUserCancel();
      });

      expect(harness.result.current.state.phase).toBe('settling');
      expect(harness.onSettle).toHaveBeenCalledTimes(1);
      expect(harness.onSettle).toHaveBeenCalledWith({
        code: 0,
        data: [],
        message: 'cancelled',
      });
      expect(harness.confirm).not.toHaveBeenCalled();
    }
  );

  it('deduplicates discard confirmation and settles only after approval', async () => {
    const decision = deferred<boolean>();
    const confirm = jest.fn<Promise<boolean>, [unknown]>(
      (_options) => decision.promise
    );
    const harness = setup({ files: [photo], confirm });
    configureReady(harness.result);

    act(() => {
      harness.result.current.requestUserCancel();
      harness.bridge()!.requestUserCancel();
    });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(harness.onSettle).not.toHaveBeenCalled();

    await act(async () => {
      decision.resolve(true);
      await decision.promise;
    });

    expect(harness.result.current.state.phase).toBe('settling');
    expect(harness.onSettle).toHaveBeenCalledTimes(1);
  });

  it('lets a declined discard confirmation be retried', async () => {
    const confirm = jest
      .fn<Promise<boolean>, [unknown]>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const harness = setup({ files: [photo], confirm });
    configureReady(harness.result);

    await act(async () => {
      harness.result.current.requestUserCancel();
      await Promise.resolve();
    });
    expect(harness.result.current.state.phase).toBe('ready');
    expect(harness.onSettle).not.toHaveBeenCalled();

    await act(async () => {
      harness.result.current.requestUserCancel();
      await Promise.resolve();
    });
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(harness.onSettle).toHaveBeenCalledTimes(1);
  });

  it('warns on discard confirmation rejection and remains retryable', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const confirm = jest
      .fn<Promise<boolean>, [unknown]>()
      .mockRejectedValueOnce(new Error('dialog failed'))
      .mockResolvedValueOnce(true);
    const harness = setup({ files: [photo], confirm });
    configureReady(harness.result);

    await act(async () => {
      harness.result.current.requestUserCancel();
      await Promise.resolve();
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(harness.result.current.state.phase).toBe('ready');

    await act(async () => {
      harness.result.current.requestUserCancel();
      await Promise.resolve();
    });
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(harness.onSettle).toHaveBeenCalledTimes(1);
  });

  it('routes preview cancellation through the same deduplicated discard confirmation', async () => {
    const decision = deferred<boolean>();
    const confirm = jest.fn<Promise<boolean>, [unknown]>(
      (_options) => decision.promise
    );
    const harness = setup({ files: [photo], confirm });
    configureReady(harness.result);
    act(() => {
      expect(
        harness.result.current.openPreview({
          variant: 'gallery',
          index: 0,
        })
      ).toBe(true);
      harness.result.current.requestUserCancel();
      harness.result.current.requestUserCancel();
    });

    expect(confirm).toHaveBeenCalledTimes(1);
    await act(async () => {
      decision.resolve(true);
      await decision.promise;
    });

    expect(harness.onSettle).toHaveBeenCalledTimes(1);
    expect(harness.result.current.state.phase).toBe('settling');
  });

  it('ignores a discard approval that became stale after phase changed', async () => {
    const decision = deferred<boolean>();
    const harness = setup({
      files: [photo],
      confirm: jest.fn<Promise<boolean>, [unknown]>(
        (_options) => decision.promise
      ),
    });
    configureReady(harness.result);

    act(() => {
      harness.result.current.requestUserCancel();
      expect(harness.result.current.beginPhoto()).not.toBeNull();
    });
    await act(async () => {
      decision.resolve(true);
      await decision.promise;
    });

    expect(harness.result.current.state.phase).toBe('capturingPhoto');
    expect(harness.onSettle).not.toHaveBeenCalled();
  });

  it('deduplicates recording confirmation and invalidates the operation before cancel', async () => {
    const decision = deferred<boolean>();
    const cancelled = deferred<void>();
    let controllerResult: ReturnType<typeof setup>['result'] | undefined;
    let token: CameraOperationToken | undefined;
    const cancelRecording = jest.fn(() => {
      expect(controllerResult!.current.isCurrent(token!)).toBe(false);
      expect(
        controllerResult!.current.videoFinished(token!, {
          file: video,
          duration: 1,
          reason: 'cancelled',
        })
      ).toBe(false);
      return cancelled.promise;
    });
    const harness = setup({
      confirm: jest.fn<Promise<boolean>, [unknown]>(
        (_options) => decision.promise
      ),
      cancelRecording,
    });
    controllerResult = harness.result;
    configureReady(harness.result);
    token = beginRecording(harness.result);

    act(() => {
      harness.result.current.requestUserCancel();
      harness.result.current.requestUserCancel();
    });
    expect(harness.confirm).toHaveBeenCalledTimes(1);

    await act(async () => {
      decision.resolve(true);
      await decision.promise;
    });
    expect(cancelRecording).toHaveBeenCalledTimes(1);
    expect(harness.onSettle).not.toHaveBeenCalled();

    await act(async () => {
      cancelled.resolve();
      await cancelled.promise;
    });
    expect(harness.onSettle).toHaveBeenCalledTimes(1);
    expect(harness.onSettle).toHaveBeenCalledWith({
      code: 0,
      data: [],
      message: 'cancelled',
    });
  });

  it('does not notify user-cancel settle when force teardown takes ownership while native cancel is pending', async () => {
    const cancelled = deferred<void>();
    const cancelRecording = jest.fn(() => cancelled.promise);
    const harness = setup({ cancelRecording });
    configureReady(harness.result);
    beginRecording(harness.result);
    const retainedBridge = harness.bridge()!;

    await act(async () => {
      harness.result.current.requestUserCancel();
      await Promise.resolve();
    });
    expect(harness.result.current.state.phase).toBe('settling');
    expect(cancelRecording).toHaveBeenCalledTimes(1);

    act(() => {
      retainedBridge.forceTeardown();
    });
    await act(async () => {
      cancelled.resolve();
      await cancelled.promise;
    });

    expect(cancelRecording).toHaveBeenCalledTimes(1);
    expect(harness.onSettle).not.toHaveBeenCalled();
  });

  it('does not notify user-cancel settle after real unmount while native cancel is pending', async () => {
    const cancelled = deferred<void>();
    const cancelRecording = jest.fn(() => cancelled.promise);
    const harness = setup({ cancelRecording });
    configureReady(harness.result);
    beginRecording(harness.result);

    await act(async () => {
      harness.result.current.requestUserCancel();
      await Promise.resolve();
    });
    expect(harness.result.current.state.phase).toBe('settling');
    expect(cancelRecording).toHaveBeenCalledTimes(1);

    act(() => {
      harness.unmount();
    });
    await act(async () => {
      cancelled.resolve();
      await cancelled.promise;
    });

    expect(harness.unregister).toHaveBeenCalledTimes(1);
    expect(cancelRecording).toHaveBeenCalledTimes(1);
    expect(harness.onSettle).not.toHaveBeenCalled();
  });

  it('does not notify stale user-cancel settle when native cancel rejects after force teardown', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const cancelled = deferred<void>();
    const cancelRecording = jest.fn(() => cancelled.promise);
    const harness = setup({ cancelRecording });
    configureReady(harness.result);
    beginRecording(harness.result);

    await act(async () => {
      harness.result.current.requestUserCancel();
      await Promise.resolve();
    });
    act(() => {
      harness.result.current.forceTeardown();
    });
    await act(async () => {
      cancelled.reject(new Error('cancel failed'));
      try {
        await cancelled.promise;
      } catch {
        // cancel adapter 自己吞掉 rejection；这里仅等待同一个 deferred 释放 continuation。
      }
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(cancelRecording).toHaveBeenCalledTimes(1);
    expect(harness.onSettle).not.toHaveBeenCalled();
  });

  it('ignores recording approval after native finish changed the operation', async () => {
    const decision = deferred<boolean>();
    const harness = setup({
      confirm: jest.fn<Promise<boolean>, [unknown]>(
        (_options) => decision.promise
      ),
    });
    configureReady(harness.result);
    const token = beginRecording(harness.result);

    act(() => {
      harness.result.current.requestUserCancel();
      expect(
        harness.result.current.videoFinished(token, {
          file: video,
          duration: 12,
          reason: 'max-duration',
        })
      ).toBe(true);
    });
    await act(async () => {
      decision.resolve(true);
      await decision.promise;
    });

    expect(harness.result.current.state).toMatchObject({
      phase: 'ready',
      files: [video],
    });
    expect(harness.cancelRecording).not.toHaveBeenCalled();
    expect(harness.onSettle).not.toHaveBeenCalled();
  });

  it('warns on recording confirmation rejection and lets user cancel retry', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const confirm = jest
      .fn<Promise<boolean>, [unknown]>()
      .mockRejectedValueOnce(new Error('dialog failed'))
      .mockResolvedValueOnce(true);
    const harness = setup({ confirm });
    configureReady(harness.result);
    beginRecording(harness.result);

    await act(async () => {
      harness.result.current.requestUserCancel();
      await Promise.resolve();
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(harness.result.current.state.phase).toBe('recording');
    expect(harness.cancelRecording).not.toHaveBeenCalled();

    await act(async () => {
      harness.result.current.requestUserCancel();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(harness.cancelRecording).toHaveBeenCalledTimes(1);
    expect(harness.onSettle).toHaveBeenCalledTimes(1);
  });

  it('warns when recording cancellation rejects, stays settling and still settles cancelled', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const cancelRecording = jest
      .fn<Promise<void>, []>()
      .mockRejectedValue(new Error('cancel failed'));
    const harness = setup({ cancelRecording });
    configureReady(harness.result);
    beginRecording(harness.result);

    await act(async () => {
      harness.result.current.requestUserCancel();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(harness.result.current.state.phase).toBe('settling');
    expect(harness.onSettle).toHaveBeenCalledTimes(1);
  });

  it('warns when force cancellation throws synchronously and never restores state', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const harness = setup({
      cancelRecording: jest.fn(() => {
        throw new Error('cancel failed');
      }),
    });
    configureReady(harness.result);
    beginRecording(harness.result);

    act(() => {
      harness.result.current.forceTeardown();
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(harness.result.current.state.phase).toBe('settling');
    expect(harness.onSettle).not.toHaveBeenCalled();
  });

  it('warns when force cancellation rejects asynchronously and stays settling', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const harness = setup({
      cancelRecording: jest
        .fn<Promise<void>, []>()
        .mockRejectedValue(new Error('cancel failed')),
    });
    configureReady(harness.result);
    beginRecording(harness.result);

    await act(async () => {
      harness.result.current.forceTeardown();
      await Promise.resolve();
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(harness.result.current.state.phase).toBe('settling');
    expect(harness.onSettle).not.toHaveBeenCalled();
  });

  it('settles exactly once even when onSettle synchronously reenters', () => {
    let controllerResult: ReturnType<typeof setup>['result'] | undefined;
    const accepted: boolean[] = [];
    const onSettle = jest.fn<void, [CameraResult]>((_result) => {
      accepted.push(controllerResult!.current.settle(savedResult));
    });
    const harness = setup({ onSettle });
    controllerResult = harness.result;
    configureReady(harness.result);

    act(() => {
      accepted.unshift(harness.result.current.settle(savedResult));
      accepted.push(harness.result.current.settle(savedResult));
    });

    expect(accepted).toEqual([true, false, false]);
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(harness.result.current.state.phase).toBe('settling');
  });

  it('ignores user cancellation after settling has begun', () => {
    const harness = setup();
    configureReady(harness.result);
    act(() => {
      expect(harness.result.current.settle(savedResult)).toBe(true);
      harness.result.current.requestUserCancel();
    });

    expect(harness.confirm).not.toHaveBeenCalled();
    expect(harness.onSettle).toHaveBeenCalledTimes(1);
    expect(harness.onSettle).toHaveBeenCalledWith(savedResult);
  });

  it('unregisters and makes operation callbacks stale on unmount', () => {
    const harness = setup();
    configureReady(harness.result);
    const token = beginRecording(harness.result);
    const controller = harness.result.current;

    act(() => {
      harness.unmount();
    });

    expect(harness.unregister).toHaveBeenCalledTimes(1);
    expect(controller.isCurrent(token)).toBe(false);
    expect(
      controller.videoFinished(token, {
        file: video,
        duration: 1,
        reason: 'completed',
      })
    ).toBe(false);
    expect(harness.onSettle).not.toHaveBeenCalled();
  });

  it('allows a retained bridge to cancel native recording after real unmount without settling', () => {
    const harness = setup();
    configureReady(harness.result);
    beginRecording(harness.result);
    const retainedBridge = harness.bridge()!;

    act(() => {
      harness.unmount();
      retainedBridge.forceTeardown();
    });

    expect(harness.cancelRecording).toHaveBeenCalledTimes(1);
    expect(harness.onSettle).not.toHaveBeenCalled();
  });

  it('keeps one bridge identity usable through React StrictMode effect replay', () => {
    const unregister = jest.fn();
    const registerController = jest.fn(
      (_sessionId: number, _bridge: SessionControllerBridge) => unregister
    );
    const cancelRecording = jest.fn();
    const onSettle = jest.fn();

    function StrictHarness() {
      useCameraSessionController({
        sessionId: 41,
        initialState: {
          files: [],
          modeIndex: 0,
          aspectRatio: '16:9',
          activePosition: 'back',
          canFlip: true,
          flash: 'off',
          sound: false,
          nativeConfigurationKey: 'device=back-1|output=photo',
        },
        registerController,
        confirm: jest.fn().mockResolvedValue(true),
        cancelRecording,
        onSettle,
      });
      return null;
    }

    render(createElement(StrictMode, null, createElement(StrictHarness)));

    expect(registerController).toHaveBeenCalledTimes(2);
    expect(unregister).toHaveBeenCalledTimes(1);
    expect(registerController.mock.calls[0]?.[1]).toBe(
      registerController.mock.calls[1]?.[1]
    );
    expect(cancelRecording).not.toHaveBeenCalled();
    expect(onSettle).not.toHaveBeenCalled();

    act(() => {
      registerController.mock.calls[1]![1].requestUserCancel();
    });
    expect(onSettle).toHaveBeenCalledTimes(1);
  });
});
