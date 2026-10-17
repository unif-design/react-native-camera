import NativePhotoProcessor from '../../../NativePhotoProcessor';
import {
  inspectPhotoFile,
  processPhotoFile,
  nativePhotoProcessingStage,
} from '../../../camera/image/nativePhotoProcessor';

const inspectPhotoFileMock = jest.mocked(NativePhotoProcessor.inspectPhotoFile);

beforeEach(() => {
  jest.clearAllMocks();
});

it.each(['up', 'right', 'down', 'left'] as const)(
  '接受 VisionCamera 官方方向值 %s',
  async (orientation) => {
    inspectPhotoFileMock.mockResolvedValue(
      JSON.stringify({ width: 1080, height: 1920, orientation })
    );

    await expect(inspectPhotoFile('/tmp/input.jpg')).resolves.toEqual({
      width: 1080,
      height: 1920,
      orientation,
    });
  }
);

it.each([undefined, null, '', 'sideways', 90])(
  '拒绝无效原生照片方向值 %p',
  async (orientation) => {
    inspectPhotoFileMock.mockResolvedValue(
      JSON.stringify({ width: 1080, height: 1920, orientation })
    );

    await expect(inspectPhotoFile('/tmp/input.jpg')).rejects.toThrow(
      'Invalid native photo orientation'
    );
  }
);

it.each(['null', '[]', '3', '"text"', '{broken'])(
  'rejects malformed photo metadata %s',
  async (response) => {
    inspectPhotoFileMock.mockResolvedValueOnce(response);
    await expect(inspectPhotoFile('/tmp/input.jpg')).rejects.toThrow();
  }
);

it.each([0, -1, null, '100'])(
  'rejects invalid photo dimensions %p',
  async (width) => {
    inspectPhotoFileMock.mockResolvedValueOnce(
      JSON.stringify({ width, height: 200, orientation: 'up' })
    );
    await expect(inspectPhotoFile('/tmp/input.jpg')).rejects.toThrow(
      'Invalid native photo dimensions'
    );
  }
);

it('rejects non-finite dimensions from the native bridge', async () => {
  inspectPhotoFileMock.mockResolvedValueOnce(
    '{"width":1e999,"height":200,"orientation":"up"}'
  );
  await expect(inspectPhotoFile('/tmp/input.jpg')).rejects.toThrow(
    'Invalid native photo dimensions'
  );
});

it.each([
  [undefined, 0],
  [null, 0],
  ['20', 0],
  [-1, 0],
  [20, 20],
])(
  'normalizes photo duration %p and accepts the flat legacy diagnostics shape',
  async (durationMs, expected) => {
    jest.mocked(NativePhotoProcessor.processPhoto).mockResolvedValueOnce(
      JSON.stringify({
        width: 100.4,
        height: 200.2,
        inputWidth: 400,
        inputHeight: 800,
        outputWidth: 100,
        outputHeight: 200,
        sampled: false,
        durationMs,
      })
    );
    await expect(
      processPhotoFile({
        inputPath: '/tmp/in.jpg',
        outputPath: '/tmp/out.jpg',
        aspectRatio: '4:3',
        targetWidth: 100,
        targetHeight: 200,
        quality: 0.8,
      })
    ).resolves.toEqual({
      width: 100,
      height: 200,
      diagnostics: {
        inputWidth: 400,
        inputHeight: 800,
        outputWidth: 100,
        outputHeight: 200,
        sampled: false,
        durationMs: expected,
      },
    });
    expect(NativePhotoProcessor.processPhoto).toHaveBeenCalledWith(
      '/tmp/in.jpg',
      '/tmp/out.jpg',
      '4:3',
      100,
      200,
      0.8,
      'null'
    );
  }
);

it('preserves nested diagnostics and serializes the caller watermark', async () => {
  jest.mocked(NativePhotoProcessor.processPhoto).mockResolvedValueOnce(
    JSON.stringify({
      width: 100,
      height: 200,
      diagnostics: {
        inputWidth: 400,
        inputHeight: 800,
        outputWidth: 100,
        outputHeight: 200,
        sampled: true,
        durationMs: 0,
      },
    })
  );
  await expect(
    processPhotoFile({
      inputPath: '/tmp/in.jpg',
      outputPath: '/tmp/out.jpg',
      aspectRatio: '4:3',
      targetWidth: 100,
      targetHeight: 200,
      quality: 0.8,
      watermark: { lines: ['original'], position: 'bottom-left' },
    })
  ).resolves.toMatchObject({ diagnostics: { sampled: true, durationMs: 0 } });
  expect(NativePhotoProcessor.processPhoto).toHaveBeenCalledWith(
    '/tmp/in.jpg',
    '/tmp/out.jpg',
    '4:3',
    100,
    200,
    0.8,
    JSON.stringify({ content: ['original'], position: 'bottom-left' })
  );
});

it.each([
  [null, null],
  [undefined, null],
  ['failure', null],
  [{}, null],
  [{ code: 'UNKNOWN' }, null],
  [{ code: 'E_PHOTO_READ' }, 'read'],
  [{ code: 'E_PHOTO_DECODE' }, 'decode'],
  [{ code: 'E_PHOTO_ALLOCATE' }, 'surface'],
  [{ code: 'E_PHOTO_CROP' }, 'crop'],
  [{ code: 'E_PHOTO_WATERMARK' }, 'watermark'],
  [{ code: 'E_PHOTO_ENCODE' }, 'encode'],
  [{ code: 'E_PHOTO_WRITE' }, 'write'],
])('maps native failure stage %p', (error, stage) => {
  expect(nativePhotoProcessingStage(error)).toBe(stage);
});
