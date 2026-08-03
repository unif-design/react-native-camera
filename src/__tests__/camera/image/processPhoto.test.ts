import type { SkData, SkImage } from '@shopify/react-native-skia';
import { makePhotoFile } from '../../__helpers__/factories';
import {
  processPhoto,
  PhotoProcessingError,
  type PhotoProcessingSnapshot,
} from '../../../camera/image/processPhoto';
import { createFileRegistry } from '../../../camera/session/fileRegistry';

const RNFS = require('@dr.pogodin/react-native-fs');
const skia = require('@shopify/react-native-skia');

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

type HarnessFailure = 'decode' | 'surface' | 'encode' | 'write';

function installNativeHarness(
  options: {
    failure?: HarnessFailure;
    dataPromise?: Promise<SkData>;
    decodedWidth?: number;
    decodedHeight?: number;
  } = {}
) {
  const order: string[] = [];
  const data = {
    dispose: jest.fn(() => order.push('data')),
  } as unknown as SkData;
  const image = {
    width: jest.fn(() => options.decodedWidth ?? 3000),
    height: jest.fn(() => options.decodedHeight ?? 4000),
    dispose: jest.fn(() => order.push('image')),
  } as unknown as SkImage;
  const paint = {
    dispose: jest.fn(() => order.push('paint')),
  };
  const paragraph = {
    layout: jest.fn(),
    paint: jest.fn(),
    getHeight: jest.fn(() => 120),
    dispose: jest.fn(() => order.push('paragraph')),
  };
  const builder: Record<string, jest.Mock> = {};
  builder.pushStyle = jest.fn(() => builder);
  builder.addText = jest.fn(() => builder);
  builder.pop = jest.fn(() => builder);
  builder.reset = jest.fn(() => builder);
  builder.build = jest.fn(() => paragraph);
  builder.dispose = jest.fn(() => order.push('builder'));
  const snapshot = {
    encodeToBase64: jest.fn(() => {
      if (options.failure === 'encode') throw new Error('encode failed');
      return 'OUTBASE64';
    }),
    dispose: jest.fn(() => order.push('snapshot')),
  };
  const canvas = {
    drawImageRect: jest.fn(),
    rotate: jest.fn(),
    scale: jest.fn(),
    concat: jest.fn(),
  };
  let surfaceWidth = 0;
  let surfaceHeight = 0;
  const surface = {
    getCanvas: jest.fn(() => canvas),
    makeImageSnapshot: jest.fn(() => snapshot),
    width: jest.fn(() => surfaceWidth),
    height: jest.fn(() => surfaceHeight),
    dispose: jest.fn(() => order.push('surface')),
  };

  if (options.dataPromise) {
    skia.Skia.Data.fromURI.mockImplementation(() => options.dataPromise);
  } else {
    skia.Skia.Data.fromURI.mockResolvedValue(data);
  }
  skia.Skia.Image.MakeImageFromEncoded.mockReturnValue(
    options.failure === 'decode' ? null : image
  );
  skia.Skia.Surface.MakeOffscreen.mockImplementation(
    (width: number, height: number) => {
      surfaceWidth = width;
      surfaceHeight = height;
      return options.failure === 'surface' ? null : surface;
    }
  );
  skia.Skia.Paint.mockReturnValue(paint);
  skia.Skia.ParagraphBuilder.Make.mockReturnValue(builder);
  if (options.failure === 'write') {
    RNFS.writeFile.mockRejectedValue(new Error('write failed'));
  } else {
    RNFS.writeFile.mockResolvedValue(undefined);
  }

  return {
    order,
    data,
    image,
    paint,
    paragraph,
    builder,
    snapshot,
    canvas,
    surface,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('无裁切且无有效 watermark 时返回 raw，0 decode / encode', async () => {
  const raw = makeRaw();
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
  expect(skia.Skia.Data.fromURI).not.toHaveBeenCalled();
  expect(skia.Skia.Image.MakeImageFromEncoded).not.toHaveBeenCalled();
  expect(skia.Skia.Surface.MakeOffscreen).not.toHaveBeenCalled();
  expect(RNFS.writeFile).not.toHaveBeenCalled();
});

it('crop + watermark 恰好一次 decode / surface / snapshot / JPEG encode / write', async () => {
  const native = installNativeHarness();
  const unlink = jest.fn(async () => {});
  const registry = createFileRegistry(unlink);
  const raw = makeRaw();
  registry.register(raw.path);

  const result = await processPhoto(raw, makeOperation(), registry);

  expect(skia.Skia.Data.fromURI).toHaveBeenCalledTimes(1);
  expect(skia.Skia.Image.MakeImageFromEncoded).toHaveBeenCalledTimes(1);
  expect(skia.Skia.Surface.MakeOffscreen).toHaveBeenCalledTimes(1);
  expect(native.surface.makeImageSnapshot).toHaveBeenCalledTimes(1);
  expect(native.snapshot.encodeToBase64).toHaveBeenCalledTimes(1);
  expect(RNFS.writeFile).toHaveBeenCalledTimes(1);
  expect(skia.Skia.Surface.MakeOffscreen).toHaveBeenCalledWith(2250, 4000);
  expect(native.canvas.drawImageRect).toHaveBeenCalledWith(
    native.image,
    { x: 375, y: 0, width: 2250, height: 4000 },
    { x: 0, y: 0, width: 2250, height: 4000 },
    native.paint
  );
  expect(native.paragraph.paint).toHaveBeenCalledTimes(1);
  expect(result).toMatchObject({
    path: '/tmp/camera_capture-7_42_capture-7.jpg',
    uri: 'file:///tmp/camera_capture-7_42_capture-7.jpg',
    width: 2250,
    height: 4000,
    cameraType: 'front',
  });
  expect(registry.stateOf(result.path)).toBe('owned');
  expect(registry.stateOf(raw.path)).toBe('owned');
  expect(unlink).not.toHaveBeenCalled();
});

it('相同 session/capture 的不同 raw 生成独立 final path', async () => {
  installNativeHarness();
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
  const firstRegistry = createFileRegistry(jest.fn(async () => {}));
  const secondRegistry = createFileRegistry(jest.fn(async () => {}));

  firstRegistry.register(firstRaw.path);
  secondRegistry.register(secondRaw.path);
  const first = await processPhoto(firstRaw, makeOperation(), firstRegistry);
  const second = await processPhoto(secondRaw, makeOperation(), secondRegistry);

  expect(first.path).toBe('/tmp/camera_raw-a_42_capture-7.jpg');
  expect(second.path).toBe('/tmp/camera_raw-b_42_capture-7.jpg');
  expect(first.path).not.toBe(second.path);
  expect(firstRegistry.stateOf(first.path)).toBe('owned');
  expect(secondRegistry.stateOf(second.path)).toBe('owned');
  const writtenPaths = RNFS.writeFile.mock.calls.map(
    (call: [string]) => call[0]
  );
  expect(writtenPaths).toEqual([first.path, second.path]);
});

it.each([
  { quality: undefined, expected: 90 },
  { quality: 0.734, expected: 73 },
  { quality: -0.5, expected: 0 },
  { quality: 1.5, expected: 100 },
])(
  'JPEG quality $quality → round(clamp) = $expected',
  async ({ quality, expected }) => {
    const native = installNativeHarness();
    const registry = createFileRegistry(jest.fn(async () => {}));

    await processPhoto(
      makeRaw(),
      makeOperation({ mode: { quality }, watermark: undefined }),
      registry
    );

    expect(native.snapshot.encodeToBase64).toHaveBeenCalledWith(
      skia.ImageFormat.JPEG,
      expected
    );
  }
);

it.each<HarnessFailure>(['decode', 'surface', 'encode', 'write'])(
  '%s 失败 reject typed internal error，并清理 raw / 可能的失败产物',
  async (failure) => {
    installNativeHarness({ failure });
    const unlink = jest.fn(async () => {});
    const registry = createFileRegistry(unlink);
    const raw = makeRaw();
    registry.register(raw.path);

    const promise = processPhoto(raw, makeOperation(), registry);

    await expect(promise).rejects.toBeInstanceOf(PhotoProcessingError);
    await expect(promise).rejects.toMatchObject({
      code: 'photo_processing_failed',
      stage: failure,
    });
    expect(registry.stateOf(raw.path)).toBe('deleted');
    expect(unlink).toHaveBeenCalledWith(raw.path);
    if (failure === 'write') {
      expect(registry.stateOf('/tmp/camera_capture-7_42_capture-7.jpg')).toBe(
        'deleted'
      );
      expect(unlink).toHaveBeenCalledWith(
        '/tmp/camera_capture-7_42_capture-7.jpg'
      );
    }
  }
);

it('video 直接返回且不登记、不调用 processor native 边界', async () => {
  const raw = makePhotoFile({
    id: 'video-1',
    path: '/video.mp4',
    uri: 'file:///video.mp4',
    mode: 'video',
    mime: 'video/mp4',
  });
  const registry = createFileRegistry(jest.fn(async () => {}));

  const result = await processPhoto(raw, makeOperation(), registry);

  expect(result).toBe(raw);
  expect(registry.stateOf(raw.path)).toBeUndefined();
  expect(skia.Skia.Data.fromURI).not.toHaveBeenCalled();
  expect(RNFS.writeFile).not.toHaveBeenCalled();
});

it('成功后按 snapshot → paragraph → builder → paint → surface → image → data 逆序 dispose', async () => {
  const native = installNativeHarness();
  const registry = createFileRegistry(jest.fn(async () => {}));

  await processPhoto(makeRaw(), makeOperation(), registry);

  expect(native.order).toEqual([
    'snapshot',
    'paragraph',
    'builder',
    'paint',
    'surface',
    'image',
    'data',
  ]);
});

it('成功只登记 final 并立即返回，不删除 raw 或等待慢 unlink', async () => {
  const native = installNativeHarness();
  const unlinkPending = deferred<void>();
  const unlink = jest.fn(() => unlinkPending.promise);
  const registry = createFileRegistry(unlink);
  const raw = makeRaw();
  registry.register(raw.path);

  const processing = processPhoto(raw, makeOperation(), registry);
  const outcome = await Promise.race([
    processing.then(() => 'resolved'),
    new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), 20)
    ),
  ]);
  unlinkPending.resolve();

  expect(outcome).toBe('resolved');
  await expect(processing).resolves.toMatchObject({
    path: '/tmp/camera_capture-7_42_capture-7.jpg',
  });

  expect(registry.stateOf('/tmp/camera_capture-7_42_capture-7.jpg')).toBe(
    'owned'
  );
  expect(registry.stateOf(raw.path)).toBe('owned');
  expect(unlink).not.toHaveBeenCalled();
  expect(native.order).toEqual([
    'snapshot',
    'paragraph',
    'builder',
    'paint',
    'surface',
    'image',
    'data',
  ]);
});

it.each([{ orientation: 6 }, { orientation: 2, mirrored: true }])(
  'Skia decoded origin $orientation/$mirrored 直接进入 crop，不做二次 rotate/mirror',
  async (metadata) => {
    const native = installNativeHarness({
      decodedWidth: 3000,
      decodedHeight: 4000,
    });
    const raw = Object.assign(makeRaw(), { metadata });
    const registry = createFileRegistry(jest.fn(async () => {}));

    await processPhoto(raw, makeOperation({ watermark: undefined }), registry);

    expect(native.canvas.drawImageRect).toHaveBeenCalledWith(
      native.image,
      { x: 375, y: 0, width: 2250, height: 4000 },
      { x: 0, y: 0, width: 2250, height: 4000 },
      native.paint
    );
    expect(native.canvas.rotate).not.toHaveBeenCalled();
    expect(native.canvas.scale).not.toHaveBeenCalled();
    expect(native.canvas.concat).not.toHaveBeenCalled();
  }
);

it('await 期间外部 mode / aspect / watermark / position 改变不影响快门快照', async () => {
  const pendingData = deferred<SkData>();
  const native = installNativeHarness({ dataPromise: pendingData.promise });
  const registry = createFileRegistry(jest.fn(async () => {}));
  const operation = makeOperation({
    mode: { quality: 0.77 },
    watermark: { content: ['原始水印'], position: 'bottom-right' },
  });

  const processing = processPhoto(makeRaw(), operation, registry);
  operation.aspectRatio = '4:3';
  operation.mode.quality = 0.1;
  operation.watermark!.content[0] = '变化后水印';
  operation.watermark!.position = 'top-left';
  operation.cameraPosition = 'back';
  pendingData.resolve(native.data);

  const result = await processing;

  expect(skia.Skia.Surface.MakeOffscreen).toHaveBeenCalledWith(2250, 4000);
  expect(native.snapshot.encodeToBase64).toHaveBeenCalledWith(
    skia.ImageFormat.JPEG,
    77
  );
  expect(native.builder.addText).toHaveBeenCalledWith('原始水印');
  expect(result.cameraType).toBe('front');
});

it('入口已过期时同步摘除 raw 所有权，不读取或等待慢 unlink', async () => {
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
  expect(unlink).toHaveBeenCalledTimes(1);
  expect(skia.Skia.Data.fromURI).not.toHaveBeenCalled();
});

it('Data.fromURI 后过期会释放 data、清理 raw，且不继续 decode', async () => {
  const native = installNativeHarness();
  const unlink = jest.fn(async () => {});
  const registry = createFileRegistry(unlink);
  const raw = makeRaw();
  registry.register(raw.path);
  const isCurrent = jest
    .fn<boolean, []>()
    .mockReturnValueOnce(true)
    .mockReturnValueOnce(false);

  await expect(
    processPhoto(raw, makeOperation(), registry, { isCurrent })
  ).rejects.toBeInstanceOf(PhotoProcessingError);

  expect(isCurrent).toHaveBeenCalledTimes(2);
  expect(registry.stateOf(raw.path)).toBe('deleted');
  expect(skia.Skia.Image.MakeImageFromEncoded).not.toHaveBeenCalled();
  expect(native.order).toEqual(['data']);
});

it('write 后先登记 final 再检查过期，并且每个 path 最多 unlink 一次', async () => {
  installNativeHarness();
  const unlink = jest.fn(async () => {});
  const registry = createFileRegistry(unlink);
  const raw = makeRaw();
  const outputPath = '/tmp/camera_capture-7_42_capture-7.jpg';
  registry.register(raw.path);
  const isCurrent = jest
    .fn<boolean, []>()
    .mockReturnValueOnce(true)
    .mockReturnValueOnce(true)
    .mockImplementationOnce(() => {
      expect(registry.stateOf(outputPath)).toBe('owned');
      return false;
    });

  await expect(
    processPhoto(raw, makeOperation(), registry, { isCurrent })
  ).rejects.toBeInstanceOf(PhotoProcessingError);

  expect(registry.stateOf(raw.path)).toBe('deleted');
  expect(registry.stateOf(outputPath)).toBe('deleted');
  expect(unlink).toHaveBeenCalledTimes(2);
  expect(unlink).toHaveBeenCalledWith(raw.path);
  expect(unlink).toHaveBeenCalledWith(outputPath);
});

it('write 失败会立即 reject 并同步摘除所有权，不等待慢 unlink', async () => {
  installNativeHarness({ failure: 'write' });
  const unlinkPending = deferred<void>();
  const unlink = jest.fn(() => unlinkPending.promise);
  const registry = createFileRegistry(unlink);
  const raw = makeRaw();
  registry.register(raw.path);

  const processing = processPhoto(raw, makeOperation(), registry, {
    isCurrent: () => true,
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
  expect(registry.stateOf(raw.path)).toBe('deleted');
  expect(registry.stateOf('/tmp/camera_capture-7_42_capture-7.jpg')).toBe(
    'deleted'
  );
  expect(unlink).toHaveBeenCalledTimes(2);
  expect(unlink).toHaveBeenCalledWith(raw.path);
  expect(unlink).toHaveBeenCalledWith('/tmp/camera_capture-7_42_capture-7.jpg');
});

it('有 cleanup delegate 时交还 raw/partial final，由调用方决定删除时机', async () => {
  installNativeHarness({ failure: 'write' });
  const unlink = jest.fn(async () => {});
  const registry = createFileRegistry(unlink);
  const raw = makeRaw();
  const outputPath = '/tmp/camera_capture-7_42_capture-7.jpg';
  registry.register(raw.path);
  const onCleanupRequired = jest.fn<void, [readonly string[]]>();
  const context = {
    isCurrent: () => true,
    onCleanupRequired,
  } as Parameters<typeof processPhoto>[3] & {
    onCleanupRequired: (paths: readonly string[]) => void;
  };

  await expect(
    processPhoto(raw, makeOperation(), registry, context)
  ).rejects.toBeInstanceOf(PhotoProcessingError);

  expect(onCleanupRequired).toHaveBeenCalledTimes(1);
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
    processPhoto(raw, makeOperation(), registry, { isCurrent: () => true })
  ).rejects.toBeInstanceOf(PhotoProcessingError);

  expect(RNFS.writeFile).not.toHaveBeenCalled();
  expect(unlink).toHaveBeenCalledTimes(1);
  expect(unlink).toHaveBeenCalledWith(raw.path);
});
