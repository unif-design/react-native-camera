import { useCallback, useRef, useState, type RefObject } from 'react';
import type {
  CameraMode,
  CameraResult,
  CustomPhotoFile,
  OpenConfig,
} from '../../utils';
import type { CameraHandle } from '../Camera';
import type { AspectRatio } from '../setup';
import { burnWatermark, cropToRatio } from '../watermark';
import { useVideoRecorder } from './useVideoRecorder';

type ConfirmFn = (o: { title: string; message?: string }) => Promise<boolean>;

type Params = {
  cameraRef: RefObject<CameraHandle | null>;
  config: OpenConfig;
  /** 当前模式(由 Container 的 modeIndex 派生),用于快门分支判断。 */
  currentMode: CameraMode | undefined;
  /** 当前画幅(Container 持有)。'16:9' 时照片拍后 Skia 居中裁切(photo 流恒 4:3 全幅出图)。 */
  aspectRatio: AspectRatio;
  /** 当前模式下标(Container 持有,渲染 ModeSwitcherPill 用);onSelectMode 切它。 */
  modeIndex: number;
  setModeIndex: (i: number) => void;
  settle: (result: CameraResult) => void;
  confirm: ConfirmFn;
  /** 拍摄/录像失败时弹顶部非阻塞错误条(不 settle、不关相机,用户可重试)。Container 传 showError。 */
  onError: (msg: string) => void;
};

export type CaptureFlow = {
  photos: CustomPhotoFile[];
  setPhotos: React.Dispatch<React.SetStateAction<CustomPhotoFile[]>>;
  previewing: boolean;
  setPreviewing: React.Dispatch<React.SetStateAction<boolean>>;
  previewVariant: 'confirm' | 'gallery';
  setPreviewVariant: React.Dispatch<
    React.SetStateAction<'confirm' | 'gallery'>
  >;
  flashNonce: number;
  burning: boolean;
  /** 一次快门(capture/烧水印/录像 start·stop)处理中:快门按钮据此禁用,防连点。 */
  capturing: boolean;
  /** 录像状态(透传 useVideoRecorder),供 Container 渲染计时器/控件。 */
  recording: boolean;
  recSeconds: number;
  onShutter: () => Promise<void>;
  /** 原生侧自发结束录像(maxDuration 到点/磁盘满)的视频文件入 photos + 复位录制态。传给 Camera.onSpontaneousVideoFinish。 */
  onVideoAutoFinished: (file: CustomPhotoFile) => void;
  handleSave: () => void;
  handleCancel: () => Promise<void>;
  onSelectMode: (i: number) => Promise<void>;
};

/**
 * 拍摄编排:photos + 预览态 + flash/burning + 快门(照片/视频分支)+ 保存/取消/切模式。
 * 内部组合 useVideoRecorder —— 视频分支的「stop 后有 file 加 photos / 无 file settle 503」
 * 编排正落在驱动它的 onShutter 里,recording/recSeconds 透传给 Container 渲染。
 * modeIndex 仍由 Container 持有(渲染 ModeSwitcherPill 需要),经入参传入由 onSelectMode 切换。
 */
export function useCaptureFlow({
  cameraRef,
  config,
  currentMode,
  aspectRatio,
  modeIndex,
  setModeIndex,
  settle,
  confirm,
  onError,
}: Params): CaptureFlow {
  const [photos, setPhotos] = useState<CustomPhotoFile[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [previewVariant, setPreviewVariant] = useState<'confirm' | 'gallery'>(
    'gallery'
  );
  const [flashNonce, setFlashNonce] = useState(0);
  const [burning, setBurning] = useState(false);
  const [capturing, setCapturing] = useState(false);
  // 防重入(同步守卫,state 异步更新挡不住同帧连点):上一次快门(UHD capture +
  // Skia 全分辨率烧水印)没处理完就忽略后续点击。没有它,疯狂连点快门会让多个
  // capture/烧录并发堆积 → 内存峰值叠加 → iOS 内存压力直接杀进程(闪退)。
  // 「串行烧水印、峰值内存恒定」只在单次 onShutter 内成立,跨次并发必须在这里挡。
  const capturingRef = useRef(false);

  const { recording, recSeconds, startRecording, stopRecording, markStopped } =
    useVideoRecorder(cameraRef);

  const onShutter = async () => {
    if (capturingRef.current) return;
    capturingRef.current = true;
    setCapturing(true);
    try {
      if (currentMode?.mode === 'video') {
        if (!recording) {
          // 启动失败不关相机:弹错误条让用户重试(对齐 1.x「失败停留」,而非进假录制态丢已拍)。
          const ok = await startRecording();
          if (!ok) onError('录像启动失败,请重试');
        } else {
          const f = await stopRecording();
          if (f) setPhotos((prev) => [...prev, f]);
          // 停止失败同样不关相机:弹错误条,用户可重录(不再 settle 503 关闭丢已拍)。
          else onError('录像失败,请重试');
        }
        return;
      }
      const f = await cameraRef.current?.capture();
      if (!f) {
        // 失败不关相机:弹顶部错误条让用户重拍(对齐 1.x「失败停留可重试」,而非 settle 关闭丢已拍)。
        onError('拍摄失败,请重试');
        return;
      }
      setFlashNonce((n) => n + 1);
      // 快门后串行处理这一张(一次只处理 1 张,峰值内存恒定):
      //   1. 16:9 → 先 cropToRatio 居中裁切(photo 流恒 4:3 全幅出图,见 Camera.tsx);
      //   2. 有水印 → 在(裁切后的)图上烧水印(水印 layout 自动按裁后宽算)。
      // 任一步在 jpeg 上生效就置 burning(footer 显示"正在生成水印图片…",并停取景防露未裁画面);
      // 裁切较快、文案对纯裁切略不精确但可接受(burning 包住两步)。video 文件不裁/不烧。
      const isJpeg = f.mime === 'image/jpeg';
      const needCrop = isJpeg && aspectRatio === '16:9';
      const wm = isJpeg ? config.watermark : undefined; // 非 jpeg 不烧
      let saved = f;
      if (needCrop || wm != null) {
        setBurning(true);
        try {
          if (needCrop) saved = await cropToRatio(saved, '16:9');
          if (wm != null) saved = await burnWatermark(saved, wm);
        } finally {
          setBurning(false);
        }
      }
      setPhotos((prev) => [...prev, saved]);
      // 自动预览规则:仅「非保留(clear) + 单拍」拍完进预览;其余累积
      if (
        currentMode?.mode === 'single' &&
        config.dataRetainedMode === 'clear'
      ) {
        setPreviewVariant('confirm');
        setPreviewing(true);
      }
    } finally {
      capturingRef.current = false;
      setCapturing(false);
    }
  };

  const onVideoAutoFinished = useCallback(
    (file: CustomPhotoFile) => {
      // 原生侧自发结束(maxDuration 到点 / 磁盘满 / 中断):文件入 photos + 复位录制态(与手动停录一致
      // 累积,不进预览、不 settle)。recording 必须复位,否则计时器卡住、UI 停在假录制态。
      setPhotos((prev) => [...prev, file]);
      markStopped();
    },
    [markStopped]
  );

  const onSelectMode = async (i: number) => {
    if (i === modeIndex) return;
    if (config.dataRetainedMode === 'clear' && photos.length > 0) {
      const ok = await confirm({
        title: '切换拍摄模式',
        message: '切换将清空已拍摄的照片,是否继续?',
      });
      if (!ok) return;
      setPhotos([]);
    }
    setModeIndex(i);
  };

  // 照片在快门后已逐张烧好,保存直接返回。
  const handleSave = () => {
    settle({ code: 200, data: photos, message: 'ok' });
  };

  const handleCancel = async () => {
    if (photos.length > 0) {
      const ok = await confirm({
        title: '放弃拍摄',
        message: `放弃已拍 ${photos.length} 张?`,
      });
      if (!ok) return;
    }
    settle({ code: 0, data: [], message: 'cancelled' });
  };

  return {
    photos,
    setPhotos,
    previewing,
    setPreviewing,
    previewVariant,
    setPreviewVariant,
    flashNonce,
    burning,
    capturing,
    recording,
    recSeconds,
    onShutter,
    onVideoAutoFinished,
    handleSave,
    handleCancel,
    onSelectMode,
  };
}
