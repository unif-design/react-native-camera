import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useCameraDevice } from 'react-native-vision-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  r,
  type as t,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';
import type { CameraResult, OpenConfig } from '../utils';
import { useCameraDialog } from './ui/CameraDialogHost';
import { useAppActive } from './hooks/useAppActive';
import { usePermissionFlow } from './hooks/usePermissionFlow';
import { useZoomController } from './hooks/useZoomController';
import { useCaptureFlow } from './hooks/useCaptureFlow';
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
import { WatermarkStamp } from './watermark';
import { VIEWFINDER } from './colors/viewfinder';

// 控件浮层需让出底部 footer。footer 高度由内容(快门/模式行)+ 安全区决定、随语言/机型变,
// 故用 onLayout 实测(见 footerHeight);此处只留估值,兜底 onLayout 测得前的首帧防跳动。
const FOOTER_FALLBACK = r(120);
// zoomChips 离 footer 顶(模式行)的间隔。收紧到 r(8) 让倍数药丸更贴近单拍/连拍行。
// (真机可再微调:布局常量、非 worklet。)
const CONTROL_GAP = r(8);
// 左侧竖栏(SideRail/SideActions)下沉:以 footer 顶为基准上抬 SIDE_RAIL_LIFT,使其底缘落在
// 模式行(单拍/连拍)附近、与之大致水平对齐(此前 +r(30) 偏高,见 IMG_1193)。
// 取小正值让竖栏底缘略高于 footer 顶、贴住模式行;真机按观感再调(布局常量、非 worklet)。
const SIDE_RAIL_LIFT = r(4);

// absolute 浮层的层级意图:footer 必须最高(始终可点)→ sideRail → zoomChips/watermark。
const Z = { overlay: 7, sideRail: 9, footer: 10 };

type Props = {
  config: OpenConfig;
  onSettle: (r: CameraResult) => void;
};

export function Container({ config, onSettle }: Props) {
  // 本地弹窗:切模式/放弃拍摄的二次确认走相机 Modal 内部 host(见 ui/CameraDialogHost),
  // 不走 design 全局 confirm —— 后者会被相机 Modal 盖住。showError 同源(顶部非阻塞错误条)。
  const { confirm, showError } = useCameraDialog();
  const styles = useThemedStyles(makeStyles);
  const settledRef = useRef(false);
  // App 前后台:切后台时停取景(对齐官方 isActive=isAppActive&&isScreenFocused)。
  const appActive = useAppActive();

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

  const state = usePermissionFlow();

  const insets = useSafeAreaInsets();
  // 初始前/后摄由 config 首个 mode 的 type 决定(H5 传入),缺省 back。
  // 运行时翻转(S7):直接切 position state(无翻转动画,真机反馈奇怪故移除)。
  // 5.x：physicalDevices 字符串不带 -camera。请求 ultra-wide-angle + wide-angle
  // 换取 0.5x 超广角档(0.5x 的「用户倍数」经下方 displayMul 转换,见 useZoomController;不是 minZoom≤0.5)。
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

  // 变焦控制器:vzf↔display 推导、zoom state/shared、设备切换 clamp 全在 hook 内。
  // zoom 显示全程走 UI 线程 zoomShared(pinch 不刷 state);setZoom 仅点击档/手势结束/设备切换回写。
  const { setZoom, zoomShared, pinching, displayMul, minDisplay, maxDisplay } =
    useZoomController(device);

  const cameraRef = useRef<CameraHandle>(null);
  const [modeIndex, setModeIndex] = useState(0);
  const currentMode = config.cameraMode[modeIndex];

  // 拍摄编排:photos / 预览态 / 快门(照片+视频)/ 保存取消 / 切模式 / 录像状态全在 hook 内。
  const {
    photos,
    setPhotos,
    previewing,
    setPreviewing,
    previewVariant,
    setPreviewVariant,
    flashNonce,
    burning,
    recording,
    recSeconds,
    onShutter,
    handleSave,
    handleCancel,
    onSelectMode,
  } = useCaptureFlow({
    cameraRef,
    config,
    currentMode,
    modeIndex,
    setModeIndex,
    settle,
    confirm,
  });

  // 初始闪光从 config 首个 mode 接线(API 兼容),缺省 off。
  const [flash, setFlash] = useState<FlashMode>(
    config.cameraMode[0]?.flashMode ?? 'off'
  );
  const [sound, setSound] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('4:3');
  // footer 高度 onLayout 实测,驱动浮层(sideRail/zoomChips)的 bottom;初值用估值防首帧跳动。
  const [footerHeight, setFooterHeight] = useState(FOOTER_FALLBACK);

  // 翻转前/后摄:直接切 position(device 随之更新,zoom 在 useZoomController 内 clamp);无视觉动画。
  const onFlip = () => {
    setPosition((p) => (p === 'back' ? 'front' : 'back'));
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
        // 取景仅在 App 前台且非烧录态时活:烧水印时停取景(省电 + 释放摄像头),回前台恢复。
        // 预览态由上方 previewing 分支整体卸载 Camera(不靠此 gate);Modal 不可见时
        // Container 根本不挂载,故无需额外可见性 prop。
        isActive={appActive && !burning}
        flash={flash}
        aspectRatio={aspectRatio}
        zoomShared={zoomShared}
        pinching={pinching}
        // 前摄定焦 → 关 pinch(只留点击对焦),与下方「前置不渲染变焦档」一致。
        enableZoom={position === 'back'}
        // pinch 放大软上限(vzf):maxDisplay 已并入 SOFT_MAX_DISPLAY,÷displayMul 回 vzf。
        softMaxZoom={maxDisplay / displayMul}
        // pinch 结束回写一次 JS 侧 zoom(vzf):供设备切换 clamp 基准,不 pinch 全程回写(性能)。
        onZoomEnd={setZoom}
        sound={sound}
        // session 出错 → 顶部非阻塞错误条(showError 自带去抖,可恢复错误连发不刷屏)。
        // 绝不 settle(500):onError 含可恢复瞬时错误,误当致命会让重开报错关闭(见 Camera.tsx)。
        onCameraError={(e) => showError(e?.message || '相机会话异常,请重试')}
      />

      {!recording && config.watermark && (
        <View style={styles.watermark} pointerEvents="none">
          <WatermarkStamp watermark={config.watermark} />
        </View>
      )}

      {!recording && (
        <View
          style={[styles.sideRail, { bottom: footerHeight + SIDE_RAIL_LIFT }]}
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

      {/* 前置(front)不渲染变焦档:前摄定焦、变焦无意义且 0.5x 不存在;切回后置恢复显示。
          ZoomChips = 0.5/1 档位药丸(点击跳档,高亮当前档)+ pinch 时浮现的大号实时倍数。
          变焦本身由 Camera 的双指 pinch 写 zoomShared 驱动(见 Camera.tsx)。 */}
      {!recording && position === 'back' && (
        <View
          style={[styles.zoomChips, { bottom: footerHeight + CONTROL_GAP }]}
        >
          <ZoomChips
            zoomShared={zoomShared}
            pinching={pinching}
            displayMul={displayMul}
            // 0.5 档仅超广角机型有:设备最广(minDisplay)≤ 0.5x 才渲染(±1e-3 容浮点漂移)。
            showHalf={minDisplay <= 0.5 + 1e-3}
            onSelect={(displayZ) => {
              // 点击档:边界用 display 空间,内部 zoom/zoomShared 仍是 vzf。
              // display → vzf 反算(÷displayMul)再 clamp 回设备 vzf 范围。
              const vzf = Math.min(
                Math.max(displayZ / displayMul, device.minZoom),
                device.maxZoom
              );
              setZoom(vzf);
              zoomShared.value = vzf;
            }}
          />
        </View>
      )}

      <CaptureFlash trigger={flashNonce} />

      <View
        style={[styles.bottom, { paddingBottom: insets.bottom + r(6) }]}
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
    // footer 透明:早期叠半透明黑遮罩在取景底缘,与下方纯黑 root 底拼出一条
    // "浅灰带 / 一浅一深"分界 —— 改 transparent 让 footer 区直接露统一的 root
    // 黑底,消除深浅分界。zIndex 最高仍保证控件可点。
    // footer 整体下沉、更贴底:paddingBottom 只留 home-indicator 间距(见 JSX insets.bottom+r(6)),
    // paddingTop 收紧;gap = 模式行(单拍/连拍)与快门行的间距,缩小让模式行更贴近快门。
    bottom: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: r(8),
      gap: r(10),
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
    burningText: { color: c.foreground, fontSize: t.sm },
  });
