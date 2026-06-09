import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import {
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import {
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  r,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';
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
import { VIEWFINDER } from './colors/viewfinder';

// 控件浮层需让出底部 footer。footer 高度由内容(快门/模式行)+ 安全区决定、随语言/机型变,
// 故用 onLayout 实测(见 footerHeight);此处只留估值,兜底 onLayout 测得前的首帧防跳动。
const FOOTER_FALLBACK = r(120);
// 浮层底与 footer 顶的间隔:zoomChips 离 footer 顶 CONTROL_GAP,sideRail 再高一档(+r(30))。
const CONTROL_GAP = r(12);

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
  const styles = useThemedStyles(makeStyles);
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
  // 运行时翻转(S7):直接切 position state(无翻转动画,真机反馈奇怪故移除)。
  // 5.x：physicalDevices 字符串不带 -camera。请求 ultra-wide-angle + wide-angle
  // 换取 0.5x 超广角档(device.minZoom≤0.5 → ZoomChips 自动显示 0.5)。
  // physicalDevices 是 best-match 排序、非硬过滤(vision-camera 文档:「filter
  // never excludes cameras」):不支持超广角的机型会自动 fallback 到 wide-angle
  // (minZoom=1、无 0.5x 但照常工作),不会因缺超广角而 device==null;真正的
  // device==null 仅「该方向无相机」时出现,已由下方 NoCamera(code 404)兜底,不崩。
  // 历史上单 'wide-angle' 为规避 iOS #3773,启用超广角后需真机验证不复现。
  const initialPosition = config.cameraMode[0]?.type ?? 'back';
  const [position, setPosition] = useState<'back' | 'front'>(initialPosition);
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
  const [sound, setSound] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('4:3');
  const [flashNonce, setFlashNonce] = useState(0);
  const [recSeconds, setRecSeconds] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [burning, setBurning] = useState(false);
  // footer 高度 onLayout 实测,驱动浮层(sideRail/zoomChips)的 bottom;初值用估值防首帧跳动。
  const [footerHeight, setFooterHeight] = useState(FOOTER_FALLBACK);
  const zoomShared = useSharedValue(1);

  // pinch 实时更新 zoomShared(UI 线程),这里节流回写 zoom state 让变焦条近实时跟手。
  // 只读 zoomShared、只 setZoom(不回写 zoomShared)→ 不成环:pinch→zoomShared→reaction→
  // setZoom 到此为止;点击 chip 是另一路(setZoom + zoomShared.value= 一起,见 onSelect)。
  useAnimatedReaction(
    () => zoomShared.value,
    (cur, prev) => {
      // 节流:变化够大才回写 state,避免每帧 setState。
      if (prev == null || Math.abs(cur - prev) > 0.02) runOnJS(setZoom)(cur);
    }
  );

  // TODO(临时): 真机确认超广角 minZoom 后移除。帮用户核对前/后置设备的缩放能力(0.5x 是否可用)。
  // vision-camera 5.x 的 CameraDevice 无 neutralZoom(4.x 字段),物理镜头列表用 physicalDevices。
  useEffect(() => {
    if (device)
      console.log('[camera] device zoom', {
        position,
        minZoom: device.minZoom,
        maxZoom: device.maxZoom,
        physicalDevices: device.physicalDevices,
      });
  }, [device, position]);

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

  // 翻转前/后摄:直接切 position(device 随之更新,zoom 在下方 effect clamp);无视觉动画。
  const onFlip = () => {
    setPosition((p) => (p === 'back' ? 'front' : 'back'));
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
      />

      {!recording && config.watermark && (
        <View style={styles.watermark} pointerEvents="none">
          <WatermarkStamp watermark={config.watermark} />
        </View>
      )}

      {!recording && (
        <View
          style={[
            styles.sideRail,
            { bottom: footerHeight + CONTROL_GAP + r(30) },
          ]}
        >
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

      {/* 前置(front)不渲染变焦条:前摄定焦、变焦无意义且 0.5x 不存在;切回后置恢复显示。 */}
      {!recording && position === 'back' && (
        <View
          style={[styles.zoomChips, { bottom: footerHeight + CONTROL_GAP }]}
        >
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

      <View
        style={[styles.bottom, { paddingBottom: insets.bottom + r(20) }]}
        onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
      >
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

const makeStyles = (c: ColorTokens) =>
  StyleSheet.create({
    // 相机主容器固定黑底:相机 UX 惯例(取景物理常量),不走 c.background token。
    // position:relative → 内部 absolute 浮层(footer/sideRail/zoomChips)以整屏为参照。
    root: { flex: 1, backgroundColor: VIEWFINDER.black, position: 'relative' },
    watermark: {
      position: 'absolute',
      right: r(6),
      top: r(12),
      maxWidth: r(230),
      zIndex: Z.overlay,
    },
    // 控件浮层的 bottom 由 footerHeight 实测内联设置(见 JSX),这里只放与底无关的样式。
    sideRail: {
      position: 'absolute',
      left: r(12),
      gap: r(10),
      zIndex: Z.sideRail,
    },
    zoomChips: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: Z.overlay,
    },
    // footer 透明:原来叠半透明黑遮罩(VIEWFINDER.footerScrim)在取景底缘,
    // 与下方纯黑 root 底拼出一条"浅灰带 / 一浅一深"分界 —— 改 transparent 让
    // footer 区直接露统一的 root 黑底,消除深浅分界。zIndex 最高仍保证控件可点。
    bottom: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: r(14),
      gap: r(16),
      backgroundColor: 'transparent',
      zIndex: Z.footer,
    },
    center: { alignItems: 'center' },
    burningFooter: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: r(8),
      paddingVertical: r(16),
    },
    burningText: { color: c.foreground, fontSize: r(14) },
  });
