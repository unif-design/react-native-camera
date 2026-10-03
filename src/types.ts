export type CameraFacing = 'front' | 'back';
export type CameraFlash = 'auto' | 'on' | 'off';
export interface CameraPhotoMode {
  mode: 'single' | 'continuous';
  quality?: number;
  qualityPriority?: 'speed' | 'balanced' | 'quality';
  hdr?: boolean;
}
export interface CameraVideoMode {
  mode: 'video';
  maxDurationSeconds?: number;
  bitRate?: number;
}
export type CameraModeOptions = CameraPhotoMode | CameraVideoMode;
export type CameraCaptureMode = CameraModeOptions['mode'];
export interface CameraWatermark {
  lines: readonly string[];
  position?:
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';
}
export interface CameraInput {
  modes: readonly CameraModeOptions[];
  initialFacing?: CameraFacing;
  initialFlash?: CameraFlash;
  retention: 'clear' | 'retain';
  watermark?: CameraWatermark;
}
export interface CameraMedia {
  id: string;
  uri: string;
  mode: CameraCaptureMode;
  facing: CameraFacing;
  mimeType: 'image/jpeg' | 'video/mp4';
  width: number;
  height: number;
  durationMs?: number;
}
export interface CameraFailure {
  reason:
    | 'invalid_input'
    | 'permission_denied'
    | 'no_device'
    | 'unavailable'
    | 'unsupported';
  message: string;
}
export interface CameraSelected {
  status: 'success';
  media: readonly CameraMedia[];
}
export interface CameraCancelled {
  status: 'cancelled';
}
export interface CameraFailed {
  status: 'failed';
  error: CameraFailure;
}
export type CameraOutcome = CameraSelected | CameraCancelled | CameraFailed;
export interface CameraCallOptions {
  signal?: AbortSignal;
}
export interface CameraController {
  open(
    input: Readonly<CameraInput>,
    options?: CameraCallOptions
  ): Promise<CameraOutcome>;
}
