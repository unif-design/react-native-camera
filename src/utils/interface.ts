export type CameraType = 'back' | 'front';

export type PhotoQuality = 'speed' | 'balanced' | 'quality';

export type DataRetainedMode = 'clear' | 'retain';

export type CameraModeName = 'single' | 'continuous' | 'video';

export type Point = { x: number; y: number };

export type CameraMode = {
  mode: CameraModeName;
  photoQuality?: PhotoQuality;
  jpegQuality?: number;
};

export type OpenConfig = {
  cameraMode: CameraMode[];
  dataRetainedMode: DataRetainedMode;
};

export type CustomPhotoFile = {
  path: string;
  uri: string;
  width: number;
  height: number;
  mime: 'image/jpeg' | 'video/mp4';
  mode: CameraModeName;
  duration?: number;
};

export type CameraResultCode = 0 | 200 | 403 | 404 | 500 | 503;

export type CameraResult = {
  code: CameraResultCode;
  data: CustomPhotoFile[];
  message: string;
};

export type CameraApi = {
  open: (config: OpenConfig) => Promise<CameraResult>;
  close: () => void;
};
