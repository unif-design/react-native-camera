import type {
  CameraOutcome,
  CameraFailure,
  CameraMedia,
} from '@unif/react-native-camera';

export type ResultTone = 'success' | 'neutral' | 'error';
export type ResultDiagnostic = 'cancelled' | CameraFailure['reason'];
export type MediaPresentation = CameraMedia;
export type ResultPresentation = {
  status: CameraOutcome['status'];
  label: string;
  tone: ResultTone;
  diagnostic: ResultDiagnostic | null;
  message: string;
  media: readonly MediaPresentation[];
  temporaryFileWarning: boolean;
};

const failureLabels: Record<CameraFailure['reason'], string> = {
  invalid_input: '配置无效',
  permission_denied: '相机权限被拒绝',
  no_device: '无可用相机设备',
  unavailable: '相机暂不可用',
  unsupported: '当前平台不支持拍摄',
};

export function projectMedia(file: CameraMedia): MediaPresentation {
  return {
    id: file.id,
    facing: file.facing,
    mode: file.mode,
    uri: file.uri,
    width: file.width,
    height: file.height,
    mimeType: file.mimeType,
    ...(file.durationMs === undefined ? {} : { durationMs: file.durationMs }),
  };
}

export function classifyCameraResult(
  result: CameraOutcome
): ResultPresentation {
  if (result.status === 'success') {
    return {
      status: result.status,
      label: '拍摄成功',
      tone: 'success',
      diagnostic: null,
      message: '用户已确认拍摄结果',
      media: result.media.map(projectMedia),
      temporaryFileWarning: true,
    };
  }
  if (result.status === 'cancelled') {
    return {
      status: result.status,
      label: '已取消',
      tone: 'neutral',
      diagnostic: 'cancelled',
      message: '本次拍摄已取消',
      media: [],
      temporaryFileWarning: false,
    };
  }
  return {
    status: result.status,
    label: failureLabels[result.error.reason],
    tone: 'error',
    diagnostic: result.error.reason,
    message: result.error.message,
    media: [],
    temporaryFileWarning: false,
  };
}
