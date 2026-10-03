import NativePhotoProcessor from '../../../NativePhotoProcessor';
import { inspectVideoFile } from '../../../camera/video/inspectVideoFile';

jest.mock('../../../NativePhotoProcessor', () => ({
  __esModule: true,
  default: { inspectVideoFile: jest.fn() },
}));
const inspect = jest.mocked(NativePhotoProcessor.inspectVideoFile);

test('uses real file dimensions and milliseconds from the native read', async () => {
  inspect.mockResolvedValueOnce(
    '{"width":1080,"height":1920,"durationMs":1250}'
  );
  await expect(inspectVideoFile('/tmp/video.mp4')).resolves.toEqual({
    width: 1080,
    height: 1920,
    durationMs: 1250,
  });
  expect(inspect).toHaveBeenCalledWith('/tmp/video.mp4');
});
test('does not invent an unknown duration', async () => {
  inspect.mockResolvedValueOnce('{"width":1920,"height":1080}');
  await expect(inspectVideoFile('/tmp/video.mp4')).resolves.toEqual({
    width: 1920,
    height: 1080,
  });
});
test.each([
  '{}',
  '{"width":0,"height":1080}',
  '{"width":1920,"height":1080,"durationMs":-1}',
  '[]',
])(
  'rejects unusable metadata instead of delivering fake dimensions',
  async (raw) => {
    inspect.mockResolvedValueOnce(raw);
    await expect(inspectVideoFile('/tmp/video.mp4')).rejects.toThrow();
  }
);
