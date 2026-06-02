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
import { NoCamera } from './NoCamera';
import { NoPermission } from './NoPermission';
import { Loading } from '../components/Loading';
import { Camera, type CameraHandle } from './Camera';
import { PreviewOverlay } from './preview';
import { CaptureFlash } from './CaptureFlash';
import { SideRail, type AspectRatio, type FlashMode } from './setup';
import { ZoomChips } from './footer/ZoomChips';
import { ModeSwitcherPill, type ModeItem } from './footer/ModeSwitcherPill';
import { ActionRow } from './footer/ActionRow';
import { RecordingTimer } from './footer/RecordingTimer';
import { WatermarkStamp, burnWatermark } from './watermark';
import { DARK } from './colors/dark';

type Props = {
  config: OpenConfig;
  onSettle: (r: CameraResult) => void;
};

type PermissionState = 'pending' | 'granted' | 'denied';

export function Container({ config, onSettle }: Props) {
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
  // 5.x：physicalDevices 字符串不带 -camera;单 'wide-angle' 规避 iOS #3773
  const initialPosition = config.cameraMode[0]?.type ?? 'back';
  const [position, setPosition] = useState<'back' | 'front'>(initialPosition);
  const [flipNonce, setFlipNonce] = useState(0);
  const device = useCameraDevice(position, {
    physicalDevices: ['wide-angle'],
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
  const [grid, setGrid] = useState(false);
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

  const onFlip = () => {
    setPosition((p) => (p === 'back' ? 'front' : 'back'));
    setFlipNonce((n) => n + 1);
  };

  const onSelectMode = (i: number) => {
    if (config.dataRetainedMode === 'clear' && i !== modeIndex) setPhotos([]);
    setModeIndex(i);
  };

  // 照片在快门后已逐张烧好,保存直接返回。
  const handleSave = () => {
    settle({ code: 200, data: photos, message: 'ok' });
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
      <Camera
        ref={cameraRef}
        device={device}
        currentMode={currentMode}
        flash={flash}
        aspectRatio={aspectRatio}
        zoomShared={zoomShared}
        sound={sound}
        grid={grid}
        flipNonce={flipNonce}
      />

      {!recording && config.watermark && (
        <WatermarkStamp watermark={config.watermark} />
      )}

      {!recording && (
        <View style={[styles.sideRail, { bottom: insets.bottom + r(172) }]}>
          <SideRail
            flash={flash}
            aspectRatio={aspectRatio}
            sound={sound}
            grid={grid}
            onChangeFlash={setFlash}
            onChangeAspectRatio={setAspectRatio}
            onToggleSound={() => setSound((v) => !v)}
            onToggleGrid={() => setGrid((v) => !v)}
          />
        </View>
      )}
      {!recording && (
        <View style={[styles.zoomChips, { bottom: insets.bottom + r(184) }]}>
          <ZoomChips
            zoom={zoom}
            onSelect={(z) => {
              // clamp 到设备变焦范围:无超广角设备 minZoom===1,点 0.5x 不应越界
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
              onBack={() => settle({ code: 0, data: [], message: 'cancelled' })}
              onSave={handleSave}
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

      <CaptureFlash trigger={flashNonce} />
    </View>
  );
}

const styles = StyleSheet.create({
  // 相机主容器固定黑底:相机 UX 惯例(预览 / 拍照取景需要黑底凸显),
  // 不走 c.background token。
  root: {
    flex: 1,
    backgroundColor: DARK.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideRail: { position: 'absolute', left: r(12), zIndex: 9 },
  zoomChips: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 7,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: r(14),
    zIndex: 8,
    gap: r(16),
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
