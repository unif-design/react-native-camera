import NativePhotoProcessor from '../../../NativePhotoProcessor';
import { inspectPhotoFile } from '../../../camera/image/nativePhotoProcessor';

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
