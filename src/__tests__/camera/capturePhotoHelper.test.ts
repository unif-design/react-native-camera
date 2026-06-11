import { captureToTempFile } from '../../camera/capturePhotoHelper';
import type {
  CameraPhotoOutput,
  CapturePhotoSettings,
} from 'react-native-vision-camera';

// captureToTempFile 是 5.x 拍照标准序列(capturePhoto → saveToTemporaryFileAsync →
// 读 width/height/orientation → finally dispose)。核心红线:photo 是 native 包装对象,
// 无论成功/失败都要在 finally 里 dispose 释放原生内存(否则连拍大图反复堆积 → OOM 闪退,
// 与水印 Skia 逆序 dispose 同源)。这里桩出 photo 验证两条路径都 dispose + 入参/出参形态。

// 造一个桩 photo + 桩 photoOutput,saveToTemporaryFileAsync 可成功或抛错。
function makeStubs(opts: { reject?: boolean } = {}) {
  const dispose = jest.fn();
  const saveToTemporaryFileAsync = opts.reject
    ? jest.fn().mockRejectedValue(new Error('save boom'))
    : jest.fn().mockResolvedValue('/tmp/captured.jpg');
  const photo = {
    saveToTemporaryFileAsync,
    dispose,
    width: 3024,
    height: 4032,
    orientation: 'portrait',
  };
  const capturePhoto = jest.fn().mockResolvedValue(photo);
  const photoOutput = { capturePhoto } as unknown as CameraPhotoOutput;
  return { photoOutput, capturePhoto, saveToTemporaryFileAsync, dispose };
}

const settings = { flash: 'off' } as unknown as CapturePhotoSettings;

it('成功路径:capturePhoto(settings,{}) → saveToTemporaryFileAsync → 返回 path/宽高/朝向', async () => {
  const { photoOutput, capturePhoto, saveToTemporaryFileAsync, dispose } =
    makeStubs();

  const result = await captureToTempFile(photoOutput, settings);

  // capturePhoto 收到 settings + 第二参 {}(5.x 形态)。
  expect(capturePhoto).toHaveBeenCalledWith(settings, {});
  expect(saveToTemporaryFileAsync).toHaveBeenCalledTimes(1);
  expect(result).toEqual({
    path: '/tmp/captured.jpg',
    width: 3024,
    height: 4032,
    orientation: 'portrait',
  });
  // 成功路径也必须 dispose(finally 保护、释放 native 内存)。
  expect(dispose).toHaveBeenCalledTimes(1);
});

it('失败路径:saveToTemporaryFileAsync 抛错 → 仍 finally dispose 后再向上抛', async () => {
  const { photoOutput, dispose } = makeStubs({ reject: true });

  await expect(captureToTempFile(photoOutput, settings)).rejects.toThrow(
    'save boom'
  );
  // 关键红线:即便失败,photo 也已 dispose(否则原生内存泄漏 → 反复拍 OOM)。
  expect(dispose).toHaveBeenCalledTimes(1);
});
