import { renderHook } from '@testing-library/react-native';
import {
  useCamera,
  type CameraResult,
  type OpenConfig,
} from '@unif/react-native-camera';
import { createCameraRunController } from '../../../example/src/domain/cameraRun';

jest.mock('@unif/react-native-camera', () =>
  require('@unif/react-native-camera/mock')
);

const fixedDate = new Date('2026-08-03T10:20:30.000Z');
const successResult: CameraResult = {
  code: 200,
  data: [
    {
      id: 'photo-1',
      cameraType: 'back',
      cameraMode: 'single',
      path: '/tmp/photo.jpg',
      uri: 'file:///tmp/photo.jpg',
      width: 4032,
      height: 3024,
      mime: 'image/jpeg',
      mode: 'single',
      isRemake: false,
    },
  ],
  message: 'ok',
};
const cancelledResult: CameraResult = {
  code: 0,
  data: [],
  message: 'cancelled',
};

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
    mockClose: jest.mocked(api.close),
    nextId,
    now,
  };
}

it('把 factory 新建的 config 原对象交给 api.open，并保存深拷贝历史', async () => {
  const { controller, mockOpen } = createSubject();
  const config: OpenConfig = {
    cameraMode: [
      { mode: 'single', type: 'back', flashMode: 'auto', quality: 0.9 },
    ],
    dataRetainedMode: 'clear',
    watermark: {
      content: ['巡检记录', '拍摄时间：2026-08-03T10:20:30.000Z'],
      position: 'bottom-right',
    },
  };
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
  expect(outcome.record.config.cameraMode).not.toBe(config.cameraMode);
  expect(outcome.record.config.cameraMode[0]).not.toBe(config.cameraMode[0]);
  expect(outcome.record.config.watermark).not.toBe(config.watermark);
  expect(outcome.record.config.watermark?.content).not.toBe(
    config.watermark?.content
  );
  expect(outcome.snapshot).toBe(controller.getSnapshot());
  expect(outcome.snapshot.phase).toBe('idle');
  expect(outcome.snapshot.records).toHaveLength(1);
  expect(outcome.snapshot.records[0]?.result.code).toBe(200);
  expect(listener).toHaveBeenCalledTimes(2);

  config.cameraMode[0]!.quality = 0.1;
  config.watermark!.content[0] = '被调用方修改';
  expect(outcome.record.config.cameraMode[0]?.quality).toBe(0.9);
  expect(outcome.record.config.watermark?.content[0]).toBe('巡检记录');
});

it('opening 期间拒绝第二次 open，且不再次调用 api.open 或分配 run id', async () => {
  const { controller, mockOpen, nextId } = createSubject();
  const pending = deferred<CameraResult>();
  mockOpen.mockReturnValueOnce(pending.promise);
  const config: OpenConfig = {
    cameraMode: [{ mode: 'continuous', quality: 0.9 }],
    dataRetainedMode: 'retain',
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

it('close 不立即写历史，原 open resolve code 0 后只写一次', async () => {
  const { controller, mockClose, mockOpen } = createSubject();
  const pending = deferred<CameraResult>();
  mockOpen.mockReturnValueOnce(pending.promise);
  const config: OpenConfig = {
    cameraMode: [{ mode: 'video', recTime: 15 }],
    dataRetainedMode: 'clear',
  };

  const outcomePromise = controller.open('quality-lab', config);
  controller.close();
  controller.close();

  expect(mockClose).toHaveBeenCalledTimes(1);
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
  expect(controller.getSnapshot().records[0]?.result.code).toBe(0);

  controller.close();
  expect(mockClose).toHaveBeenCalledTimes(1);
  expect(controller.getSnapshot().records).toHaveLength(1);
});

it('unexpected reject 只写 RuntimeDiagnostic，不伪造 CameraResult', async () => {
  const { controller, mockOpen } = createSubject();
  const runtimeError = new Error('native bridge unavailable');
  mockOpen.mockRejectedValueOnce(runtimeError);
  const config: OpenConfig = {
    cameraMode: [{ mode: 'single', quality: 0.9 }],
    dataRetainedMode: 'clear',
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
    cameraMode: [{ mode: 'single' }],
    dataRetainedMode: 'clear',
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
