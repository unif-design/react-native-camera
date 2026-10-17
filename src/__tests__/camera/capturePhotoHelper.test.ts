import { captureToTempFile } from '../../camera/capturePhotoHelper';
import type {
  CameraPhotoOutput,
  CapturePhotoSettings,
} from 'react-native-vision-camera';

import nativePhotoProcessor from '../../NativePhotoProcessor';

const RNFS = require('@dr.pogodin/react-native-fs');

// 官方文件路径不创建 JS 持有的原生 Photo，也不需要 save/dispose 中转。尺寸与方向只读
// JPEG 文件头；若文件头读取失败，helper 必须删除已产生但尚未交给 FileRegistry 的临时文件。

function makeStubs() {
  const capturePhoto = jest.fn();
  const capturePhotoToFile = jest
    .fn()
    .mockResolvedValue({ filePath: '/tmp/captured.jpg' });
  const photoOutput = {
    capturePhoto,
    capturePhotoToFile,
  } as unknown as CameraPhotoOutput;
  return { photoOutput, capturePhoto, capturePhotoToFile };
}

const settings = { flash: 'off' } as unknown as CapturePhotoSettings;

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(nativePhotoProcessor.inspectPhotoFile)
    .mockResolvedValue(
      JSON.stringify({ width: 1440, height: 1920, orientation: 'up' })
    );
});

it('成功路径:capturePhotoToFile(settings,{}) 直接落盘，再只读文件头元数据', async () => {
  const { photoOutput, capturePhoto, capturePhotoToFile } = makeStubs();

  const result = await captureToTempFile(photoOutput, settings);

  expect(capturePhotoToFile).toHaveBeenCalledWith(settings, {});
  expect(capturePhoto).not.toHaveBeenCalled();
  expect(nativePhotoProcessor.inspectPhotoFile).toHaveBeenCalledWith(
    '/tmp/captured.jpg'
  );
  expect(result).toEqual({
    path: '/tmp/captured.jpg',
    width: 1440,
    height: 1920,
    orientation: 'up',
  });
  expect(RNFS.unlink).not.toHaveBeenCalled();
});

it('文件已生成但元数据读取失败时，先删除未登记临时文件再向上抛', async () => {
  const { photoOutput } = makeStubs();
  jest
    .mocked(nativePhotoProcessor.inspectPhotoFile)
    .mockRejectedValue(new Error('metadata boom'));

  await expect(captureToTempFile(photoOutput, settings)).rejects.toThrow(
    'metadata boom'
  );
  expect(RNFS.unlink).toHaveBeenCalledWith('/tmp/captured.jpg');
});

it('cleanup failure does not replace the original metadata failure', async () => {
  const failure = new Error('metadata unavailable');
  jest
    .mocked(nativePhotoProcessor.inspectPhotoFile)
    .mockRejectedValueOnce(failure);
  RNFS.unlink.mockRejectedValueOnce(new Error('disk busy'));
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    await expect(
      captureToTempFile(makeStubs().photoOutput, settings)
    ).rejects.toBe(failure);
    expect(RNFS.unlink).toHaveBeenCalledWith('/tmp/captured.jpg');
    expect(warn).toHaveBeenCalledWith('captured photo cleanup failed');
  } finally {
    warn.mockRestore();
  }
});
