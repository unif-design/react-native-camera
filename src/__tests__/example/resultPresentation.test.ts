import type {
  CameraResult,
  CameraResultCode,
  CustomPhotoFile,
} from '@unif/react-native-camera';
import {
  classifyCameraResult,
  projectMedia,
} from '../../../example/src/domain/resultPresentation';

const photo = {
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
} as const satisfies CustomPhotoFile;

const resultCases = [
  [0, 'neutral', '已取消', 'cancelled'],
  [403, 'error', '相机权限被拒绝', 'permission_denied'],
  [404, 'error', '无可用相机设备', 'no_device'],
  [500, 'error', '配置无效', 'invalid_config'],
  [
    503,
    'error',
    '录像失败（保留码，当前实现不主动触发）',
    'reserved_video_failure',
  ],
] as const satisfies readonly (readonly [
  Exclude<CameraResultCode, 200>,
  'neutral' | 'error',
  string,
  string,
])[];

it('code 200 投影完整媒体，并标记临时文件风险', () => {
  const result: CameraResult = {
    code: 200,
    data: [photo],
    message: 'ok',
  };

  expect(classifyCameraResult(result)).toEqual({
    code: 200,
    label: '拍摄成功',
    tone: 'success',
    diagnostic: null,
    message: 'ok',
    media: [
      {
        id: 'photo-1',
        cameraType: 'back',
        mode: 'single',
        path: '/tmp/photo.jpg',
        uri: 'file:///tmp/photo.jpg',
        width: 4032,
        height: 3024,
        mime: 'image/jpeg',
        isRemake: false,
      },
    ],
    temporaryFileWarning: true,
  });
});

it.each(resultCases)(
  'code %s 不投影媒体，并使用确定的结果语义',
  (code, tone, label, diagnostic) => {
    const result: CameraResult = {
      code,
      data: [photo],
      message: `result-${code}`,
    };

    expect(classifyCameraResult(result)).toEqual({
      code,
      label,
      tone,
      diagnostic,
      message: `result-${code}`,
      media: [],
      temporaryFileWarning: false,
    });
  }
);

it('projectMedia 保留完整公开 metadata，但兼容 mode 只展示一次', () => {
  const projected = projectMedia({
    ...photo,
    id: 'video-1',
    cameraMode: 'video',
    mode: 'video',
    path: '/tmp/video.mp4',
    uri: 'file:///tmp/video.mp4',
    width: 1920,
    height: 1080,
    mime: 'video/mp4',
    duration: 12.5,
  });

  expect(projected).toEqual({
    id: 'video-1',
    cameraType: 'back',
    mode: 'video',
    path: '/tmp/video.mp4',
    uri: 'file:///tmp/video.mp4',
    width: 1920,
    height: 1080,
    mime: 'video/mp4',
    isRemake: false,
    duration: 12.5,
  });
  expect(Object.hasOwn(projected, 'cameraMode')).toBe(false);
  expect(Object.keys(projected).filter((key) => key === 'mode')).toHaveLength(
    1
  );
});
