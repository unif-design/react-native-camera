import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import {
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { r } from '@unif/react-native-design';
import type { CameraResult, CustomPhotoFile, OpenConfig } from '../utils';
import { useCameraDialog } from './ui/CameraDialogHost';
import { NoCamera } from './NoCamera';
import { NoPermission } from './NoPermission';
import { Loading } from '../components/Loading';
import { Camera, type CameraHandle } from './Camera';
import { PreviewOverlay } from './preview';
import { CaptureFlash } from './CaptureFlash';
import { SideRail, type AspectRatio, type FlashMode } from './setup';
import { SideActions } from './setup/SideActions';
import { ZoomChips } from './footer/ZoomChips';
import { ModeSwitcherPill, type ModeItem } from './footer/ModeSwitcherPill';
import { ActionRow } from './footer/ActionRow';
import { RecordingTimer } from './footer/RecordingTimer';
import { WatermarkStamp, burnWatermark } from './watermark';
import { DARK } from './colors/dark';

// 控件浮层需让出底部 footer:footer 高度 ≈ 内容(快门 r(72) + 模式行)+ 安全区。
// 这里取一个基线常量,zoomChips 紧贴其上、sideRail 再高一档;真机按需微调(改一处联动两者)。
const FOOTER_CLEARANCE = r(120);

// absolute 浮层的层级意图:footer 必须最高(始终可点)→ sideRail → zoomChips/watermark。
const Z = { overlay: 7, sideRail: 9, footer: 10 };

type Props = {
  config: OpenConfig;
  onSettle: (r: CameraResult) => void;
};

type PermissionState = 'pending' | 'granted' | 'denied';

export function Container({ config, onSettle }: Props) {
  // 本地弹窗:切模式/放弃拍摄的二次确认走相机 Modal 内部 host(见 ui/CameraDialogHost),
  // 不走 design 全局 confirm —— 后者会被相机 Modal 盖住。
  const { confirm } = useCameraDialog();
  const settledRef = useRef(false);

  const settle = useCallback(
    (result: CameraResult) => {
      if (settledRef.current) return;
      settledRef.current = true;
      onSettle(result);
    },
    [onSettle]
  );

  useEffect(
    () => () => {
      if (!settledRef.current) {
        onSettle({ code: 0, data: [], message: 'cancelled' });
        settledRef.current = true;
      }
    },
    [onSettle]
  );

  const { hasPermission, requestPermission } = useCameraPermission();
  const [state, setState] = useState<PermissionState>(
    hasPermission ? 'granted' : 'pending'
  );

  useEffect(() => {
    if (hasPermission) {
      setState('granted');
      return;
    }
    let cancelled = false;
    // 5.x：Android 并行 requestPermission 调用会 leak coroutine（issue #3834），
    //      必须 .catch(() => {}) 兜底；依赖 hasPermission 作为 source of truth
    requestPermission()
      .then((ok) => {
        if (cancelled) return;
        setState(ok ? 'granted' : 'denied');
      })
      .catch(() => {
        if (cancelled) return;
        setState('denied');
      });
    return () => {
      cancelled = true;
    };
  }, [hasPermission, requestPermission]);

  const insets = useSafeAreaInsets();
  // 初始前/后摄由 config 首个 mode 的 type 决定(H5 传入),缺省 back。
  // 运行时翻转(S7):position state + flipNonce 触发 rotateY 动画。
  // 5.x：physicalDevices 字符串不带 -camera。请求 ultra-wide-angle + wide-angle
  // 换取 0.5x 超广角档(device.minZoom≤0.5 → ZoomChips 自动显示 0.5);
  // 历史上单 'wide-angle' 是为规避 iOS #3773,启用超广角后需真机验证不复现。
  const initialPosition = config.cameraMode[0]?.type ?? 'back';
  const [position, setPosition] = useState<'back' | 'front'>(initialPosition);
  const [flipNonce, setFlipNonce] = useState(0);
  const device = useCameraDevice(position, {
    physicalDevices: ['ultra-wide-angle', 'wide-angle'],
  });

  const cameraRef = useRef<CameraHandle>(null);
  const [photos, setPhotos] = useState<CustomPhotoFile[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [previewVariant, setPreviewVariant] = useState<'confirm' | 'gallery'>(
    'gallery'
  );
  const [recording, setRecording] = useState(false);
  const [modeIndex, setModeIndex] = useState(0);
  const currentMode = config.cameraMode[modeIndex];

  // 初始闪光从 config 首个 mode 接线(API 兼容),缺省 off。
  const [flash, setFlash] = useState<FlashMode>(
    config.cameraMode[0]?.flashMode ?? 'off'
  );
  const [sound, setSound] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('4:3');
  const [flashNonce, setFlashNonce] = useState(0);
  const [recSeconds, setRecSeconds] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [burning, setBurning] = useState(false);
  const zoomShared = useSharedValue(1);

  useEffect(() => {
    if (!recording) {
      setRecSeconds(0);
      return;
    }
    const id = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  const onShutter = async () => {
    if (currentMode?.mode === 'video') {
      if (!recording) {
        await cameraRef.current?.startVideo();
        setRecording(true);
      } else {
        const f = await cameraRef.current?.stopVideo();
        setRecording(false);
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
    if (currentMode?.mode === 'single' && config.dataRetainedMode === 'clear') {
      setPreviewVariant('confirm');
      setPreviewing(true);
    }
  };

  const flippingRef = useRef(false);
  const onFlip = () => {
    if (flippingRef.current) return;
    flippingRef.current = true;
    setFlipNonce((n) => n + 1);
    setTimeout(() => {
      setPosition((p) => (p === 'back' ? 'front' : 'back'));
    }, 180);
    setTimeout(() => {
      flippingRef.current = false;
    }, 380);
  };

  // 设备切换(翻转前/后摄)后,把当前 zoom clamp 回新设备的 min/max 范围。
  // 有意只依赖 device:仅在设备切换时 clamp,不随 zoom 变化重跑。
  useEffect(() => {
    if (device == null) return;
    const z = Math.min(Math.max(zoom, device.minZoom), device.maxZoom);
    if (z !== zoom) {
      setZoom(z);
      zoomShared.value = z;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device]);

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

  if (state === 'denied') {
    return (
      <NoPermission
        onCancel={() =>
          settle({ code: 403, data: [], message: 'permission_denied' })
        }
        onOpenSettings={() => Linking.openSettings()}
      />
    );
  }

  if (state === 'pending') {
    return (
      <View style={styles.root} testID="permission-pending">
        <Loading />
      </View>
    );
  }

  if (previewing) {
    return (
      <PreviewOverlay
        files={photos}
        variant={previewVariant}
        onRetake={() => {
          setPhotos([]);
          setPreviewing(false);
        }}
        onSave={handleSave}
        onComplete={handleSave}
        onBack={() => setPreviewing(false)}
        onDelete={(f) => {
          const next = photos.filter((x) => x !== f);
          setPhotos(next);
          if (next.length === 0) setPreviewing(false);
        }}
      />
    );
  }

  if (device == null) {
    return (
      <NoCamera
        onCancel={() => settle({ code: 404, data: [], message: 'no_device' })}
      />
    );
  }

  if (currentMode == null) {
    return (
      <NoCamera
        onCancel={() =>
          settle({ code: 500, data: [], message: 'invalid_config' })
        }
      />
    );
  }

  const modeItems: ModeItem[] = config.cameraMode.map((m, i) => ({
    key: `${m.mode}-${i}`,
    label:
      m.mode === 'single' ? '单拍' : m.mode === 'continuous' ? '连拍' : '视频',
  }));

  return (
    <View style={styles.root} testID="device-ready">
      {/* 取景铺满整屏 → 画面相对整屏垂直居中(上下黑边对称,系统相机式布局)。
          控件全部 absolute 浮在取景之上,所以这里不再用纵向 flex 分割。 */}
      <Camera
        ref={cameraRef}
        device={device}
        currentMode={currentMode}
        flash={flash}
        aspectRatio={aspectRatio}
        zoomShared={zoomShared}
        sound={sound}
        flipNonce={flipNonce}
      />

      {!recording && config.watermark && (
        <View style={styles.watermark} pointerEvents="none">
          <WatermarkStamp watermark={config.watermark} />
        </View>
      )}

      {!recording && (
        <View style={styles.sideRail}>
          <SideRail
            flash={flash}
            aspectRatio={aspectRatio}
            sound={sound}
            onChangeFlash={setFlash}
            onChangeAspectRatio={setAspectRatio}
            onToggleSound={() => setSound((v) => !v)}
          />
          <SideActions
            canSave={photos.length > 0}
            onBack={handleCancel}
            onSave={handleSave}
          />
        </View>
      )}

      {!recording && (
        <View style={styles.zoomChips}>
          <ZoomChips
            zoom={zoom}
            minZoom={device.minZoom}
            maxZoom={device.maxZoom}
            onSelect={(z) => {
              const clamped = Math.min(
                Math.max(z, device.minZoom),
                device.maxZoom
              );
              setZoom(clamped);
              zoomShared.value = clamped;
            }}
          />
        </View>
      )}

      <CaptureFlash trigger={flashNonce} />

      <View style={[styles.bottom, { paddingBottom: insets.bottom + r(20) }]}>
        {burning ? (
          <View style={styles.burningFooter} testID="burning">
            <Loading />
            <Text style={styles.burningText}>正在生成水印图片…</Text>
          </View>
        ) : (
          <>
            {recording ? (
              <View style={styles.center}>
                <RecordingTimer seconds={recSeconds} />
              </View>
            ) : (
              <View style={styles.center}>
                <ModeSwitcherPill
                  items={modeItems}
                  currentIndex={modeIndex}
                  onSelect={onSelectMode}
                />
              </View>
            )}
            <ActionRow
              mode={currentMode.mode}
              recording={recording}
              latestUri={photos.at(-1)?.uri}
              count={photos.length}
              onShutter={onShutter}
              onFlip={onFlip}
              onOpenPreview={() => {
                if (photos.length > 0) {
                  setPreviewVariant('gallery');
                  setPreviewing(true);
                }
              }}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 相机主容器固定黑底:相机 UX 惯例,不走 c.background token。
  // position:relative → 内部 absolute 浮层(footer/sideRail/zoomChips)以整屏为参照。
  root: { flex: 1, backgroundColor: DARK.black, position: 'relative' },
  watermark: {
    position: 'absolute',
    right: r(6),
    top: r(12),
    maxWidth: r(230),
    zIndex: Z.overlay,
  },
  // 控件浮层 bottom 以整屏底为参照,需让出 footer:zoomChips 紧贴 FOOTER_CLEARANCE,
  // sideRail 再高一档(+r(30));两者由同一基线联动,改 FOOTER_CLEARANCE 即可。
  sideRail: {
    position: 'absolute',
    left: r(12),
    bottom: FOOTER_CLEARANCE + r(30),
    gap: r(10),
    zIndex: Z.sideRail,
  },
  zoomChips: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: FOOTER_CLEARANCE,
    alignItems: 'center',
    zIndex: Z.overlay,
  },
  // footer 浮在取景之上:半透明黑保护底让控件可读,zIndex 最高保证可点。
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: r(14),
    gap: r(16),
    backgroundColor: DARK.black45,
    zIndex: Z.footer,
  },
  center: { alignItems: 'center' },
  burningFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: r(8),
    paddingVertical: r(16),
  },
  burningText: { color: DARK.white, fontSize: r(14) },
});
