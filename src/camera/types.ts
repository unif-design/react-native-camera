import type { ReactNode } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import type {
  CameraDevice,
  RecordingFinishedReason,
} from 'react-native-vision-camera';
import type {
  CameraModeOptions,
  CapturedFile,
  Point,
  AspectRatio,
  CameraFlash,
} from '../utils';
import type { AnimatedCameraFrameRect } from './AnimatedCameraFrame';
import type { CameraFrameRect } from './session/frameRect';

export interface FocusRequest {
  point: Point;
  requestId: number;
}

export interface VideoCallbacks {
  onFinished: (
    file: CapturedFile,
    reason: RecordingFinishedReason,
    duration: number
  ) => void;
  onError: (error: Error) => void;
  /** Camera 的 native output identity 被替换或 owner dispose；不是录像 native error。 */
  onCancelled?: () => void;
  /** 生产事务注入原 session registry；单独使用 Camera 时直接 best-effort 删除。 */
  onDiscardedFile?: (path: string) => void;
}

export interface CameraHandle {
  capture: () => Promise<CapturedFile | null>;
  startVideo: (callbacks: VideoCallbacks) => Promise<'started' | 'denied'>;
  stopVideo: () => Promise<void>;
  cancelVideo: () => Promise<void>;
  getRecordedDuration: () => number;
}

export interface CameraViewProps {
  device: CameraDevice;
  currentMode: CameraModeOptions;
  frame: CameraFrameRect;
  animatedFrame: AnimatedCameraFrameRect;
  isActive?: boolean;
  flash?: CameraFlash;
  aspectRatio?: AspectRatio;
  // 烧水印「顺滑回看」:非空时在取景框内盖一张刚拍原图(定格帧),撤掉(转 undefined/null)瞬间
  // 与实时画面同框同位、无缝。放进取景框内 → 自动继承 frameStyle 尺寸/cover/裁切。
  frozenUri?: string | null;
  zoomShared?: SharedValue<number>;
  // 是否启用双指 pinch 变焦:前摄定焦(position==='front')传 false → 只剩点击对焦。
  enableZoom?: boolean;
  enableFocus?: boolean;
  // pinch 放大软上限(vzf)= maxDisplay / displayMul(见 useZoomController);clamp 落点用。
  softMaxZoom?: number;
  // pinch 结束回写一次 JS 侧 zoom(vzf):仅手势结束,不 pinch 全程回写(性能根治)。
  onZoomEnd?: (vzf: number) => void;
  sound?: boolean;
  // 拍摄质量参数(从 Container 透传自 CameraInput)。三者**缺省 undefined = 走 SDK 默认**:
  // 缺省时一律不写入对应 option/constraint,让 vision-camera 用其默认值,不替消费者写死取舍。
  onCameraError?: (error: Error) => void;
  onConfigured?: () => void;
}

export interface SelectedPhotoConfiguration {
  identity: object;
  hdr: boolean;
}

export interface ModalViewProps {
  visible: boolean;
  onClose(): void;
  children: ReactNode;
  sessionId?: number;
}
