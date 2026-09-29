import type {
  CameraCancelled,
  CameraFailed,
  CameraInput,
  CameraMedia,
} from '../types';
export type * from '../types';
export type AspectRatio = '4:3' | '16:9';
export interface Point {
  x: number;
  y: number;
}
/** Native file paths stay within the capture and cleanup pipeline. */
export interface CapturedFile extends CameraMedia {
  path: string;
}
export interface CapturedSelection {
  status: 'success';
  media: readonly CapturedFile[];
}
export type CameraSessionOutcome =
  | CapturedSelection
  | CameraCancelled
  | CameraFailed;
export interface RawCapturedFile {
  path: string;
  width: number;
  height: number;
  durationMs?: number;
}
export interface ValidCameraInput {
  ok: true;
  config: CameraInput;
}
export interface InvalidCameraInput {
  ok: false;
  result: CameraFailed;
}
export type CameraInputValidation = ValidCameraInput | InvalidCameraInput;
