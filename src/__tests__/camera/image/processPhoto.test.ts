import { makePhotoFile } from '../../__helpers__/factories';
import {
  processPhoto,
  PhotoProcessingError,
  type PhotoProcessingSnapshot,
} from '../../../camera/image/processPhoto';
import { createFileRegistry } from '../../../camera/session/fileRegistry';

jest.mock('../../../camera/image/nativePhotoProcessor', () => ({
  processPhotoFile: jest.fn(),
  nativePhotoProcessingStage: jest.requireActual(
    '../../../camera/image/nativePhotoProcessor'
  ).nativePhotoProcessingStage,
}));

const RNFS = require('@dr.pogodin/react-native-fs');
const nativePhotoProcessor = require('../../../camera/image/nativePhotoProcessor');

type NativeResult = {
  width: number;
  height: number;
  diagnostics: {
    inputWidth: number;
    inputHeight: number;
    outputWidth: number;
    outputHeight: number;
    sampled: boolean;
    durationMs: number;
  };
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function makeRaw() {
  return makePhotoFile({
    id: 'capture-7',
    path: '/raw.jpg',
    uri: 'file:///raw.jpg',
    width: 3000,
    height: 4000,
  });
}

function makeOperation(
  overrides: Partial<PhotoProcessingSnapshot> = {}
): PhotoProcessingSnapshot {
  return {
    sessionId: 42,
    captureId: 'capture-7',
    aspectRatio: '16:9',
    mode: { quality: 0.734 },
    watermark: { content: ['标题', '正文'], position: 'bottom-right' },
    cameraPosition: 'front',
    ...overrides,
  };
}

function nativeResult(overrides: Partial<NativeResult> = {}): NativeResult {
  return {
    width: 1080,
    height: 1920,
    diagnostics: {
      inputWidth: 3000,
      inputHeight: 4000,
      outputWidth: 1080,
      outputHeight: 1920,
      sampled: true,
      durationMs: 12,
    },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  nativePhotoProcessor.processPhotoFile.mockResolvedValue(nativeResult());
});

it('目标内 4:3 且无有效水印时返回 raw，不重复编码', async () => {
  const raw = makePhotoFile({
    ...makeRaw(),
    width: 1440,
    height: 1920,
  });
  const registry = createFileRegistry(jest.fn(async () => {}));
  registry.register(raw.path);

  const result = await processPhoto(
    raw,
    makeOperation({
      aspectRatio: '4:3',
      watermark: { content: [' ', '\n'] },
    }),
    registry
  );

  expect(result).toBe(raw);
  expect(registry.stateOf(raw.path)).toBe('owned');
  expect(nativePhotoProcessor.processPhotoFile).not.toHaveBeenCalled();
  expect(RNFS.writeFile).not.toHaveBeenCalled();
});

it('目标内 16:9 且无水印时同样不做文件重编码', async () => {
  const raw = makePhotoFile({
    ...makeRaw(),
    width: 1080,
    height: 1920,
  });
  const registry = createFileRegistry(jest.fn(async () => {}));

  await expect(
    processPhoto(raw, makeOperation({ watermark: undefined }), registry)
  ).resolves.toBe(raw);
  expect(nativePhotoProcessor.processPhotoFile).not.toHaveBeenCalled();
});

it('协商尺寸偏大时，即使 4:3 无水印也会下采样到业务上限', async () => {
  const registry = createFileRegistry(jest.fn(async () => {}));
  nativePhotoProcessor.processPhotoFile.mockResolvedValue(
    nativeResult({ width: 1440, height: 1920 })
  );

  const result = await processPhoto(
    makeRaw(),
    makeOperation({ aspectRatio: '4:3', watermark: undefined }),
    registry
  );

  expect(nativePhotoProcessor.processPhotoFile).toHaveBeenCalledWith(
    expect.objectContaining({
      aspectRatio: '4:3',
      targetWidth: 1440,
      targetHeight: 1920,
    })
  );
  expect(result).toMatchObject({ width: 1440, height: 1920 });
});

it('双平台后处理只走文件级 native 边界，不创建 Base64/RNFS 写回', async () => {
  const registry = createFileRegistry(jest.fn(async () => {}));
  const raw = makeRaw();
  registry.register(raw.path);

  const result = await processPhoto(raw, makeOperation(), registry);

  expect(nativePhotoProcessor.processPhotoFile).toHaveBeenCalledWith({
    inputPath: '/raw.jpg',
    outputPath: '/tmp/camera_capture-7_42_capture-7.jpg',
    aspectRatio: '16:9',
    targetWidth: 1080,
    targetHeight: 1920,
    quality: 73,
    watermark: { content: ['标题', '正文'], position: 'bottom-right' },
  });
  expect(RNFS.writeFile).not.toHaveBeenCalled();
  expect(result).toMatchObject({
    path: '/tmp/camera_capture-7_42_capture-7.jpg',
    uri: 'file:///tmp/camera_capture-7_42_capture-7.jpg',
    width: 1080,
    height: 1920,
    cameraType: 'front',
  });
  expect(registry.stateOf(result.path)).toBe('owned');
  expect(registry.stateOf(raw.path)).toBe('owned');
});

it('横拍按方向交换目标尺寸', async () => {
  const raw = makePhotoFile({
    ...makeRaw(),
    width: 4000,
    height: 3000,
  });
  nativePhotoProcessor.processPhotoFile.mockResolvedValue(
    nativeResult({ width: 1920, height: 1080 })
  );

  await processPhoto(
    raw,
    makeOperation({ watermark: undefined }),
    createFileRegistry(jest.fn(async () => {}))
  );

  expect(nativePhotoProcessor.processPhotoFile).toHaveBeenCalledWith(
    expect.objectContaining({ targetWidth: 1920, targetHeight: 1080 })
  );
});

it('相同 session/capture 的不同 raw 生成独立 final path', async () => {
  const firstRaw = makePhotoFile({
    ...makeRaw(),
    id: 'raw-a',
    path: '/native/a.jpg',
    uri: 'file:///native/a.jpg',
  });
  const secondRaw = makePhotoFile({
    ...makeRaw(),
    id: 'raw-b',
    path: '/native/b.jpg',
    uri: 'file:///native/b.jpg',
  });

  const first = await processPhoto(
    firstRaw,
    makeOperation(),
    createFileRegistry(jest.fn(async () => {}))
  );
  const second = await processPhoto(
    secondRaw,
    makeOperation(),
    createFileRegistry(jest.fn(async () => {}))
  );

  expect(first.path).toBe('/tmp/camera_raw-a_42_capture-7.jpg');
  expect(second.path).toBe('/tmp/camera_raw-b_42_capture-7.jpg');
});

it.each([
  { quality: undefined, expected: 90 },
  { quality: 0.734, expected: 73 },
  { quality: -0.5, expected: 0 },
  { quality: 1.5, expected: 100 },
])(
  'JPEG quality $quality → round(clamp) = $expected',
  async ({ quality, expected }) => {
    await processPhoto(
      makeRaw(),
      makeOperation({ mode: { quality }, watermark: undefined }),
      createFileRegistry(jest.fn(async () => {}))
    );

    expect(nativePhotoProcessor.processPhotoFile).toHaveBeenCalledWith(
      expect.objectContaining({ quality: expected })
    );
  }
);

it.each([
  ['E_PHOTO_READ', 'read'],
  ['E_PHOTO_DECODE', 'decode'],
  ['E_PHOTO_ALLOCATE', 'surface'],
  ['E_PHOTO_CROP', 'crop'],
  ['E_PHOTO_WATERMARK', 'watermark'],
  ['E_PHOTO_ENCODE', 'encode'],
  ['E_PHOTO_WRITE', 'write'],
] as const)(
  '%s 映射为 typed %s error，并清理 raw 与可能的 partial output',
  async (code, stage) => {
    nativePhotoProcessor.processPhotoFile.mockRejectedValue(
      Object.assign(new Error('native failed'), { code })
    );
    const unlink = jest.fn(async () => {});
    const registry = createFileRegistry(unlink);
    const raw = makeRaw();
    registry.register(raw.path);

    const promise = processPhoto(raw, makeOperation(), registry);

    await expect(promise).rejects.toMatchObject({
      code: 'photo_processing_failed',
      stage,
    });
    expect(registry.stateOf(raw.path)).toBe('deleted');
    expect(registry.stateOf('/tmp/camera_capture-7_42_capture-7.jpg')).toBe(
      'deleted'
    );
    expect(unlink).toHaveBeenCalledWith(raw.path);
    expect(unlink).toHaveBeenCalledWith(
      '/tmp/camera_capture-7_42_capture-7.jpg'
    );
  }
);

it('video 直接返回且不登记、不调用照片处理器', async () => {
  const raw = makePhotoFile({
    id: 'video-1',
    path: '/video.mp4',
    uri: 'file:///video.mp4',
    mode: 'video',
    mime: 'video/mp4',
  });
  const registry = createFileRegistry(jest.fn(async () => {}));

  await expect(processPhoto(raw, makeOperation(), registry)).resolves.toBe(raw);
  expect(registry.stateOf(raw.path)).toBeUndefined();
  expect(nativePhotoProcessor.processPhotoFile).not.toHaveBeenCalled();
});

it('await 期间外部 mode/aspect/watermark/position 改变不影响快门快照', async () => {
  const pending = deferred<NativeResult>();
  nativePhotoProcessor.processPhotoFile.mockReturnValue(pending.promise);
  const operation = makeOperation({
    mode: { quality: 0.77 },
    watermark: { content: ['原始水印'], position: 'bottom-right' },
  });

  const processing = processPhoto(
    makeRaw(),
    operation,
    createFileRegistry(jest.fn(async () => {}))
  );
  operation.aspectRatio = '4:3';
  operation.mode.quality = 0.1;
  operation.watermark!.content[0] = '变化后水印';
  operation.watermark!.position = 'top-left';
  operation.cameraPosition = 'back';
  pending.resolve(nativeResult());

  const result = await processing;

  expect(nativePhotoProcessor.processPhotoFile).toHaveBeenCalledWith(
    expect.objectContaining({
      aspectRatio: '16:9',
      quality: 77,
      watermark: { content: ['原始水印'], position: 'bottom-right' },
    })
  );
  expect(result.cameraType).toBe('front');
});

it('入口已过期时同步摘除 raw 所有权，不调用 native', async () => {
  const unlinkPending = deferred<void>();
  const unlink = jest.fn(() => unlinkPending.promise);
  const registry = createFileRegistry(unlink);
  const raw = makeRaw();
  registry.register(raw.path);

  const processing = processPhoto(raw, makeOperation(), registry, {
    isCurrent: () => false,
  });
  const outcome = await Promise.race([
    processing.then(
      () => 'resolved',
      () => 'rejected'
    ),
    new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), 20)
    ),
  ]);
  unlinkPending.resolve();

  expect(outcome).toBe('rejected');
  await expect(processing).rejects.toBeInstanceOf(PhotoProcessingError);
  expect(registry.stateOf(raw.path)).toBe('deleted');
  expect(nativePhotoProcessor.processPhotoFile).not.toHaveBeenCalled();
});

it('native 完成后先登记 final 再检查 token，过期时每个路径只删一次', async () => {
  const unlink = jest.fn(async () => {});
  const registry = createFileRegistry(unlink);
  const raw = makeRaw();
  const outputPath = '/tmp/camera_capture-7_42_capture-7.jpg';
  registry.register(raw.path);
  const isCurrent = jest
    .fn<boolean, []>()
    .mockReturnValueOnce(true)
    .mockImplementationOnce(() => {
      expect(registry.stateOf(outputPath)).toBe('owned');
      return false;
    });

  await expect(
    processPhoto(raw, makeOperation(), registry, { isCurrent })
  ).rejects.toBeInstanceOf(PhotoProcessingError);

  expect(unlink).toHaveBeenCalledTimes(2);
  expect(registry.stateOf(raw.path)).toBe('deleted');
  expect(registry.stateOf(outputPath)).toBe('deleted');
});

it('native 失败会立即 reject 并摘除所有权，不等待慢 unlink', async () => {
  nativePhotoProcessor.processPhotoFile.mockRejectedValue(
    Object.assign(new Error('write failed'), { code: 'E_PHOTO_WRITE' })
  );
  const unlinkPending = deferred<void>();
  const unlink = jest.fn(() => unlinkPending.promise);
  const registry = createFileRegistry(unlink);
  const raw = makeRaw();
  registry.register(raw.path);

  const processing = processPhoto(raw, makeOperation(), registry);
  const outcome = await Promise.race([
    processing.then(
      () => 'resolved',
      () => 'rejected'
    ),
    new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), 20)
    ),
  ]);
  unlinkPending.resolve();

  expect(outcome).toBe('rejected');
  expect(unlink).toHaveBeenCalledTimes(2);
});

it('有 cleanup delegate 时交还 raw/partial final，由事务层决定冻结帧后的删除时机', async () => {
  nativePhotoProcessor.processPhotoFile.mockRejectedValue(
    Object.assign(new Error('write failed'), { code: 'E_PHOTO_WRITE' })
  );
  const unlink = jest.fn(async () => {});
  const registry = createFileRegistry(unlink);
  const raw = makeRaw();
  const outputPath = '/tmp/camera_capture-7_42_capture-7.jpg';
  registry.register(raw.path);
  const onCleanupRequired = jest.fn<void, [readonly string[]]>();

  await expect(
    processPhoto(raw, makeOperation(), registry, {
      isCurrent: () => true,
      onCleanupRequired,
    })
  ).rejects.toBeInstanceOf(PhotoProcessingError);

  expect(onCleanupRequired).toHaveBeenCalledWith([raw.path, outputPath]);
  expect(registry.stateOf(raw.path)).toBe('owned');
  expect(registry.stateOf(outputPath)).toBe('owned');
  expect(unlink).not.toHaveBeenCalled();
});

it('显式处理不得覆盖 raw；same-path 直接失败且只清理一次', async () => {
  const raw = makeRaw();
  raw.path = '/tmp/camera_capture-7_42_capture-7.jpg';
  raw.uri = 'file:///tmp/camera_capture-7_42_capture-7.jpg';
  const unlink = jest.fn(async () => {});
  const registry = createFileRegistry(unlink);
  registry.register(raw.path);

  await expect(
    processPhoto(raw, makeOperation(), registry)
  ).rejects.toBeInstanceOf(PhotoProcessingError);

  expect(nativePhotoProcessor.processPhotoFile).not.toHaveBeenCalled();
  expect(unlink).toHaveBeenCalledTimes(1);
});
