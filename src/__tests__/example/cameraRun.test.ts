import { renderHook } from '@testing-library/react-native';
import {
  useCamera,
  type CameraOutcome,
  type CameraInput,
} from '@unif/react-native-camera';
import { createCameraRunController } from '../../../example/src/domain/cameraRun';

jest.mock('@unif/react-native-camera', () =>
  require('@unif/react-native-camera/mock')
);

const fixedDate = new Date('2026-08-03T10:20:30.000Z');
const successResult: CameraOutcome = {
  status: 'success',
  media: [
    {
      id: 'photo-1',
      facing: 'back',

      uri: 'file:///tmp/photo.jpg',
      width: 4032,
      height: 3024,
      mimeType: 'image/jpeg',
      mode: 'single',
    },
  ],
};
const cancelledResult: CameraOutcome = { status: 'cancelled' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function createSubject() {
  const { result } = renderHook(() => useCamera());
  const [api] = result.current;
  const now = jest.fn(() => fixedDate);
  const nextId = jest.fn(() => 'run-1');
  const controller = createCameraRunController({ api, now, nextId });

  return {
    api,
    controller,
    mockOpen: jest.mocked(api.open),
    nextId,
    now,
  };
}

it('把 factory 新建的 config 原对象交给 api.open，并保存深拷贝历史', async () => {
  const { controller, mockOpen } = createSubject();
  const config = {
    modes: [{ mode: 'single', quality: 0.9 }],
    retention: 'clear',
    watermark: {
      lines: ['巡检记录', '拍摄时间：2026-08-03T10:20:30.000Z'],
      position: 'bottom-right',
    },
    initialFacing: 'back',
    initialFlash: 'auto',
  } satisfies CameraInput;
  mockOpen.mockResolvedValueOnce(successResult);
  const listener = jest.fn();
  controller.subscribe(listener);

  const outcome = await controller.open('basic-capture', config);

  expect(mockOpen).toHaveBeenCalledTimes(1);
  expect(mockOpen.mock.calls[0]?.[0]).toBe(config);
  expect(outcome.accepted).toBe(true);
  if (!outcome.accepted) {
    throw new Error('本次调用应被接受');
  }
  expect(outcome.record).toEqual({
    id: 'run-1',
    scenario: 'basic-capture',
    startedAt: '2026-08-03T10:20:30.000Z',
    endedAt: '2026-08-03T10:20:30.000Z',
    config,
    result: successResult,
  });
  expect(outcome.record.config).not.toBe(config);
  expect(outcome.record.config.modes).not.toBe(config.modes);
  expect(outcome.record.config.modes[0]).not.toBe(config.modes[0]);
  expect(outcome.record.config.watermark).not.toBe(config.watermark);
  expect(outcome.record.config.watermark?.lines).not.toBe(
    config.watermark?.lines
  );
  expect(outcome.snapshot).toBe(controller.getSnapshot());
  expect(outcome.snapshot.phase).toBe('idle');
  expect(outcome.snapshot.records).toHaveLength(1);
  expect(outcome.snapshot.records[0]?.result.status).toBe('success');
  expect(listener).toHaveBeenCalledTimes(2);

  config.modes[0]!.quality = 0.1;
  config.watermark!.lines[0] = '被调用方修改';
  expect(outcome.record.config.modes[0]).toMatchObject({ quality: 0.9 });
  expect(outcome.record.config.watermark?.lines[0]).toBe('巡检记录');
});

it('opening 期间拒绝第二次 open，且不再次调用 api.open 或分配 run id', async () => {
  const { controller, mockOpen, nextId } = createSubject();
  const pending = deferred<CameraOutcome>();
  mockOpen.mockReturnValueOnce(pending.promise);
  const config: CameraInput = {
    modes: [{ mode: 'continuous', quality: 0.9 }],
    retention: 'retain',
  };

  const firstOutcomePromise = controller.open('multi-mode', config);
  const busyOutcome = await controller.open('quality-lab', config);

  expect(busyOutcome).toEqual({
    accepted: false,
    reason: 'busy',
    snapshot: controller.getSnapshot(),
  });
  expect(busyOutcome.snapshot.phase).toBe('opening');
  expect(mockOpen).toHaveBeenCalledTimes(1);
  expect(nextId).toHaveBeenCalledTimes(1);

  pending.resolve(cancelledResult);
  await firstOutcomePromise;
});

it('close 不立即写历史，原 open resolve cancelled 后只写一次', async () => {
  const { controller, mockOpen } = createSubject();
  const pending = deferred<CameraOutcome>();
  mockOpen.mockReturnValueOnce(pending.promise);
  const config: CameraInput = {
    modes: [{ mode: 'video', maxDurationSeconds: 15 }],
    retention: 'clear',
  };

  const outcomePromise = controller.open('quality-lab', config);
  const signal = mockOpen.mock.calls[0]?.[1]?.signal;
  const onAbort = jest.fn();
  signal?.addEventListener('abort', onAbort);
  expect(signal?.aborted).toBe(false);
  controller.close();
  controller.close();

  expect(onAbort).toHaveBeenCalledTimes(1);
  expect(signal?.aborted).toBe(true);
  expect(controller.getSnapshot()).toMatchObject({
    phase: 'opening',
    records: [],
    diagnostics: [],
  });

  pending.resolve(cancelledResult);
  const outcome = await outcomePromise;

  expect(outcome.accepted).toBe(true);
  expect(controller.getSnapshot().phase).toBe('idle');
  expect(controller.getSnapshot().records).toHaveLength(1);
  expect(controller.getSnapshot().records[0]?.result.status).toBe('cancelled');

  controller.close();
  expect(onAbort).toHaveBeenCalledTimes(1);
  expect(signal?.aborted).toBe(true);
  expect(controller.getSnapshot().records).toHaveLength(1);
});

it('unexpected reject 只写 RuntimeDiagnostic，不伪造 CameraOutcome', async () => {
  const { controller, mockOpen } = createSubject();
  const runtimeError = new Error('native bridge unavailable');
  mockOpen.mockRejectedValueOnce(runtimeError);
  const config: CameraInput = {
    modes: [{ mode: 'single', quality: 0.9 }],
    retention: 'clear',
  };

  await expect(controller.open('watermark-evidence', config)).rejects.toBe(
    runtimeError
  );

  expect(controller.getSnapshot()).toEqual({
    phase: 'idle',
    records: [],
    diagnostics: [
      {
        runId: 'run-1',
        scenario: 'watermark-evidence',
        message: 'native bridge unavailable',
        occurredAt: '2026-08-03T10:20:30.000Z',
      },
    ],
  });
});

it('clear 清空已有记录与 diagnostic，并允许取消订阅', async () => {
  const { controller, mockOpen } = createSubject();
  mockOpen.mockResolvedValueOnce(successResult);
  const listener = jest.fn();
  const unsubscribe = controller.subscribe(listener);

  await controller.open('basic-capture', {
    modes: [{ mode: 'single' }],
    retention: 'clear',
  });
  controller.clear();

  expect(controller.getSnapshot()).toEqual({
    phase: 'idle',
    records: [],
    diagnostics: [],
  });
  expect(listener).toHaveBeenCalledTimes(3);

  unsubscribe();
  controller.clear();
  expect(listener).toHaveBeenCalledTimes(3);
});
