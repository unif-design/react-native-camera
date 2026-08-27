import { captureToTempFile } from '../../camera/capturePhotoHelper';
import type {
  CameraPhotoOutput,
  CapturePhotoSettings,
} from 'react-native-vision-camera';

jest.mock(
  '../../camera/image/nativePhotoProcessor',
  () => ({ inspectPhotoFile: jest.fn() })
);

const RNFS = require('@dr.pogodin/react-native-fs');
const nativePhotoProcessor = require('../../camera/image/nativePhotoProcessor');

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
  nativePhotoProcessor.inspectPhotoFile.mockResolvedValue({
    width: 1440,
    height: 1920,
    orientation: 'up',
  });
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
  nativePhotoProcessor.inspectPhotoFile.mockRejectedValue(
    new Error('metadata boom')
  );

  await expect(captureToTempFile(photoOutput, settings)).rejects.toThrow(
    'metadata boom'
  );
  expect(RNFS.unlink).toHaveBeenCalledWith('/tmp/captured.jpg');
});
