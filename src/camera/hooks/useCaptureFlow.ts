import { useRef, useState, type RefObject } from 'react';
import type {
  CameraMode,
  CameraResult,
  CustomPhotoFile,
  OpenConfig,
} from '../../utils';
import type { CameraHandle } from '../Camera';
import { burnWatermark } from '../watermark';
import { useVideoRecorder } from './useVideoRecorder';

type ConfirmFn = (o: { title: string; message?: string }) => Promise<boolean>;

type Params = {
  cameraRef: RefObject<CameraHandle | null>;
  config: OpenConfig;
  /** 当前模式(由 Container 的 modeIndex 派生),用于快门分支判断。 */
  currentMode: CameraMode | undefined;
  /** 当前模式下标(Container 持有,渲染 ModeSwitcherPill 用);onSelectMode 切它。 */
  modeIndex: number;
  setModeIndex: (i: number) => void;
  settle: (result: CameraResult) => void;
  confirm: ConfirmFn;
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
  modeIndex,
  setModeIndex,
  settle,
  confirm,
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

  const { recording, recSeconds, startRecording, stopRecording } =
    useVideoRecorder(cameraRef);

  const onShutter = async () => {
    if (capturingRef.current) return;
    capturingRef.current = true;
    setCapturing(true);
    try {
      if (currentMode?.mode === 'video') {
        if (!recording) {
          await startRecording();
        } else {
          const f = await stopRecording();
          if (f) setPhotos((prev) => [...prev, f]);
          else settle({ code: 503, data: [], message: 'video_failed' });
        }
        return;
      }
      const f = await cameraRef.current?.capture();
      if (!f) {
        settle({ code: 500, data: photos, message: 'capture_failed' });
        return;
      }
      setFlashNonce((n) => n + 1);
      // 快门后立刻烧这一张(串行:一次只烧 1 张,峰值内存恒定);烧时 footer 显示"正在生成水印图片"
      let saved = f;
      if (config.watermark && f.mime === 'image/jpeg') {
        setBurning(true);
        try {
          saved = await burnWatermark(f, config.watermark);
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
    handleSave,
    handleCancel,
    onSelectMode,
  };
}
