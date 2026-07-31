import type {
  AspectRatio,
  CameraType,
  CustomPhotoFile,
  FlashMode,
} from '../../utils';

export type CameraSessionPhase =
  | 'configuring'
  | 'ready'
  | 'capturingPhoto'
  | 'processingPhoto'
  | 'startingVideo'
  | 'recording'
  | 'stoppingVideo'
  | 'previewing'
  | 'settling'
  | 'closed';

export type CameraPreviewState = {
  variant: 'confirm' | 'gallery';
  index: number;
};

export type CameraSessionState = {
  phase: CameraSessionPhase;
  files: CustomPhotoFile[];
  modeIndex: number;
  aspectRatio: AspectRatio;
  activePosition: CameraType;
  canFlip: boolean;
  flash: FlashMode;
  sound: boolean;
  preview: CameraPreviewState | null;
  operationId: number | null;
  configurationGeneration: number;
  nativeConfigurationKey: string;
  video: {
    duration: number;
    reason: string | null;
  };
};

export type ConfigurationChanges = Partial<
  Pick<
    CameraSessionState,
    'modeIndex' | 'aspectRatio' | 'activePosition' | 'canFlip'
  >
>;

export type CameraSessionAction =
  | {
      type: 'BEGIN_CONFIGURATION';
      nativeConfigurationKey: string;
      changes?: ConfigurationChanges;
    }
  | { type: 'CONFIGURED'; generation: number }
  | { type: 'SET_FLASH'; flash: FlashMode }
  | { type: 'SET_SOUND'; sound: boolean }
  | { type: 'CAPTURE_PHOTO'; operationId: number }
  | { type: 'PHOTO_CAPTURED'; operationId: number }
  | {
      type: 'PHOTO_SUCCEEDED';
      operationId: number;
      file: CustomPhotoFile;
      preview?: CameraPreviewState;
    }
  | { type: 'START_VIDEO'; operationId: number }
  | { type: 'VIDEO_STARTED'; operationId: number }
  | { type: 'VIDEO_PROGRESS'; operationId: number; duration: number }
  | { type: 'STOP_VIDEO'; operationId: number; duration: number }
  | {
      type: 'VIDEO_FINISHED';
      operationId: number;
      file?: CustomPhotoFile;
      duration: number;
      reason: string;
    }
  | { type: 'OPERATION_FAILED'; operationId: number }
  | { type: 'OPEN_PREVIEW'; preview: CameraPreviewState }
  | { type: 'CLOSE_PREVIEW' }
  | { type: 'DELETE_FILE'; path: string }
  | { type: 'CLEAR_FILES' }
  | { type: 'SETTLING' }
  | { type: 'CLOSED' };

export type CameraSessionCapabilities = {
  capture: boolean;
  flip: boolean;
  mode: boolean;
  aspect: boolean;
  save: boolean;
  gallery: boolean;
  zoom: boolean;
  focus: boolean;
  userCancel: boolean;
};
