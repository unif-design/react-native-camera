import type {
  CameraFailure,
  CameraMedia,
  CameraOutcome,
} from '@unif/react-native-camera';
import {
  classifyCameraResult,
  projectMedia,
} from '../../../example/src/domain/resultPresentation';
const photo: CameraMedia = {
  id: 'photo-1',
  facing: 'back',
  mode: 'single',
  uri: 'file:///tmp/photo.jpg',
  width: 4032,
  height: 3024,
  mimeType: 'image/jpeg',
};

it('projects success media and marks temporary file ownership', () => {
  expect(classifyCameraResult({ status: 'success', media: [photo] })).toEqual({
    status: 'success',
    label: '拍摄成功',
    tone: 'success',
    diagnostic: null,
    message: '用户已确认拍摄结果',
    media: [photo],
    temporaryFileWarning: true,
  });
});

it('presents cancellation as a neutral result without media', () => {
  expect(classifyCameraResult({ status: 'cancelled' })).toEqual({
    status: 'cancelled',
    label: '已取消',
    tone: 'neutral',
    diagnostic: 'cancelled',
    message: '本次拍摄已取消',
    media: [],
    temporaryFileWarning: false,
  });
});

it.each<[CameraFailure['reason'], string]>([
  ['permission_denied', '相机权限被拒绝'],
  ['no_device', '无可用相机设备'],
  ['invalid_input', '配置无效'],
  ['unavailable', '相机暂不可用'],
  ['unsupported', '当前平台不支持拍摄'],
])('presents %s with the original message and no media', (reason, label) => {
  const result: CameraOutcome = {
    status: 'failed',
    error: { reason, message: `result-${reason}` },
  };
  expect(classifyCameraResult(result)).toEqual({
    status: 'failed',
    label,
    tone: 'error',
    diagnostic: reason,
    message: `result-${reason}`,
    media: [],
    temporaryFileWarning: false,
  });
});

it('projects the public metadata and millisecond duration without internal file fields', () => {
  const video = {
    ...photo,
    id: 'video-1',
    mode: 'video',
    mimeType: 'video/mp4',
    durationMs: 12500,
    path: '/private/video.mp4',
  } as const;
  const presentation = projectMedia(video);
  expect(presentation).toEqual({
    ...photo,
    id: 'video-1',
    mode: 'video',
    mimeType: 'video/mp4',
    durationMs: 12500,
  });
  expect(presentation).not.toHaveProperty('path');
  expect(projectMedia(photo)).not.toHaveProperty('durationMs');
});
