export type CameraType = 'back' | 'front';

export type FlashMode = 'auto' | 'on' | 'off';

export type DataRetainedMode = 'clear' | 'retain';

export type CameraModeName = 'single' | 'continuous' | 'video';

export type Point = { x: number; y: number };

export type CameraMode = {
  /** 初始前/后摄,缺省 back。H5 传入,接线为初始 device position。 */
  type?: CameraType;
  /** 初始闪光(首项 cameraMode 生效);接线为初始闪光,运行时可在相机内左侧竖栏切换。 */
  flashMode?: FlashMode;
  /** 拍摄模式。 */
  mode: CameraModeName;
  /** JPEG 压缩 0~1,缺省 0.9。质量优先级见 OpenConfig.photoQualityPrioritization(缺省走 SDK 默认 'balanced')。 */
  quality?: number;
  /**
   * 录制时长上限(秒),video 模式。已接线 vision-camera maxDuration:到点原生自动停,
   * 录好的视频自动入已拍列表(与手动停录一致)。缺省不设 → 不自动停,由用户手动结束。
   */
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
  /**
   * 照片质量优先级(全局,作用于所有照片模式)。
   * **缺省 undefined = 不传该字段,走 SDK 默认 'balanced'**(不替消费者写死取舍)。
   * 传 'speed'/'quality' 在不支持的设备会被安全降级为 'balanced'(不 throw,见 Camera.tsx
   * 的 supportsSpeedQualityPrioritization guard);'balanced' 任何设备可传。
   */
  photoQualityPrioritization?: 'speed' | 'balanced' | 'quality';
  /**
   * 是否启用照片 HDR(多帧融合,更宽动态范围)。
   * **缺省 undefined = 不加 photoHDR 约束,由相机 negotiate 决定**(不强制开/关)。
   * 传 boolean 才作为 `{ photoHDR: <值> }` 约束下发。
   */
  photoHDR?: boolean;
  /**
   * 录像目标码率(bps,全局,作用于 video 模式)。
   * **缺省 undefined = 不传,由编码器按分辨率自适应**(不写死,避免高/低分辨率配错码率)。
   * 仅在需要明确控制时传(如 4K 约 20–40Mbps)。
   */
  videoBitRate?: number;
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
