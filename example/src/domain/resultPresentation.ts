import type {
  CameraResult,
  CameraResultCode,
  CameraType,
  CameraModeName,
  CustomPhotoFile,
} from '@unif/react-native-camera';

export type ResultTone = 'success' | 'neutral' | 'error';

export type ResultDiagnostic =
  | 'cancelled'
  | 'permission_denied'
  | 'no_device'
  | 'invalid_config'
  | 'reserved_video_failure';

export type MediaPresentation = {
  id: string;
  cameraType: CameraType;
  mode: CameraModeName;
  path: string;
  uri: string;
  width: number;
  height: number;
  mime: CustomPhotoFile['mime'];
  isRemake: boolean;
  duration?: number;
};

export type ResultPresentation = {
  code: CameraResultCode;
  label: string;
  tone: ResultTone;
  diagnostic: ResultDiagnostic | null;
  message: string;
  media: readonly MediaPresentation[];
  temporaryFileWarning: boolean;
};

type ResultDescriptor = Pick<
  ResultPresentation,
  'label' | 'tone' | 'diagnostic'
>;

const resultDescriptors: Record<CameraResultCode, ResultDescriptor> = {
  0: {
    label: '已取消',
    tone: 'neutral',
    diagnostic: 'cancelled',
  },
  200: {
    label: '拍摄成功',
    tone: 'success',
    diagnostic: null,
  },
  403: {
    label: '相机权限被拒绝',
    tone: 'error',
    diagnostic: 'permission_denied',
  },
  404: {
    label: '无可用相机设备',
    tone: 'error',
    diagnostic: 'no_device',
  },
  500: {
    label: '配置无效',
    tone: 'error',
    diagnostic: 'invalid_config',
  },
  503: {
    label: '录像失败（保留码，当前实现不主动触发）',
    tone: 'error',
    diagnostic: 'reserved_video_failure',
  },
};

export function projectMedia(file: CustomPhotoFile): MediaPresentation {
  return {
    id: file.id,
    cameraType: file.cameraType,
    mode: file.mode,
    path: file.path,
    uri: file.uri,
    width: file.width,
    height: file.height,
    mime: file.mime,
    isRemake: file.isRemake,
    ...(file.duration === undefined ? {} : { duration: file.duration }),
  };
}

export function classifyCameraResult(result: CameraResult): ResultPresentation {
  const descriptor = resultDescriptors[result.code];
  const succeeded = result.code === 200;

  return {
    code: result.code,
    ...descriptor,
    message: result.message,
    media: succeeded ? result.data.map(projectMedia) : [],
    temporaryFileWarning: succeeded,
  };
}
