export type CameraType = 'back' | 'front';

export type FlashMode = 'auto' | 'on' | 'off';

export type DataRetainedMode = 'clear' | 'retain';

export type CameraModeName = 'single' | 'continuous' | 'video';

export type Point = { x: number; y: number };

export type CameraMode = {
  /** 初始前/后摄,缺省 back。H5 传入,接线为初始 device position。 */
  type?: CameraType;
  /** 初始闪光(原版字段,保留作 API 兼容)。闪光由相机内 UI 控制,不从 config 接线。 */
  flashMode?: FlashMode;
  /** 拍摄模式。 */
  mode: CameraModeName;
  /** JPEG 压缩 0~1,缺省 0.9。内部速度优先级写死 'speed'(对齐原版 4.x photoQualityBalance)。 */
  quality?: number;
  /** 录制时长上限(秒),video 模式。原版字段,保留;未用到则 no-op。 */
  recTime?: number;
};

export type WatermarkType = {
  /** 水印文字,每行一条;数量不限,消费者可自由增减 */
  content: string[];
  /** 位置,缺省 'top-right' */
  position?:
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';
};

export type OpenConfig = {
  cameraMode: CameraMode[];
  dataRetainedMode: DataRetainedMode;
  /** 水印,缺省不加;传入则取景显示戳记 + 保存时烧入成片 */
  watermark?: WatermarkType;
};

export type CustomPhotoFile = {
  // —— 原版字段 ——
  /** 唯一 id,时间戳 + 序号(避免同毫秒撞 id)。 */
  id: string;
  /** 拍摄时的前/后摄。 */
  cameraType: CameraType;
  /** 模式(原版字段名,与 mode 同值)。 */
  cameraMode: CameraModeName;
  // —— 2.x 字段 ——
  path: string;
  uri: string;
  width: number;
  height: number;
  mime: 'image/jpeg' | 'video/mp4';
  /** 模式(2.x 字段名,与 cameraMode 同值)。 */
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
