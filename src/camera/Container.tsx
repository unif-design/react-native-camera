import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useCameraDevice, type DeviceFilter } from 'react-native-vision-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  r,
  type as t,
  fw,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';
import type { CameraMode, CameraResult, OpenConfig } from '../utils';
import type {
  RegisterSessionContainer,
  RegisterSessionController,
} from './session/controllerBridge';
import { AnimatedCameraFrame } from './AnimatedCameraFrame';
import type { FileRegistry } from './session/fileRegistry';
import { nativeConfigurationKey } from './session/configuration';
import {
  selectCameraDevice,
  type SelectedCameraDevice,
} from './session/deviceSelection';
import { fitCameraFrame, type CameraViewport } from './session/frameRect';
import { useCameraDialog } from './ui/CameraDialogHost';
import { useAppActive } from './hooks/useAppActive';
import { useCameraSessionController } from './hooks/useCameraSessionController';
import { usePermissionFlow } from './hooks/usePermissionFlow';
import { usePhotoCaptureTransaction } from './hooks/usePhotoCaptureTransaction';
import { useVideoTransaction } from './hooks/useVideoTransaction';
import { useZoomController } from './hooks/useZoomController';
import { clamp } from './hooks/zoomMath';
import { NoCamera } from './NoCamera';
import { NoPermission } from './NoPermission';
import { Loading } from '../components/Loading';
import { Camera, type CameraHandle } from './Camera';
import { PreviewOverlay, MODE_LABEL } from './preview';
import { CaptureFlash } from './CaptureFlash';
import { SideRail, SideActions } from './setup';
import { ZoomChips } from './footer/ZoomChips';
import { ModeSwitcherPill, type ModeItem } from './footer/ModeSwitcherPill';
import { ActionRow } from './footer/ActionRow';
import { RecordingTimer } from './footer/RecordingTimer';
import { WatermarkStamp } from './watermark';
import { VIEWFINDER } from './colors/viewfinder';

// 控件浮层需让出底部 footer。footer 高度由内容(快门/模式行)+ 安全区决定、随语言/机型变,
// 故用 onLayout 实测(见 footerHeight);此处只留估值,兜底 onLayout 测得前的首帧防跳动。
const FOOTER_FALLBACK = r(120);
// zoomChips 离 footer 顶(模式行)的间隔:取小值让档位药丸紧贴模式行(布局常量、非 worklet,真机可微调)。
const CONTROL_GAP = r(2);
// 左侧竖栏(SideRail/SideActions)以 footer 顶为基准上抬这点距离,使其底缘落在模式行(单拍/连拍)附近、
// 与之大致水平对齐(取近 0 的小值让竖栏底缘贴住 footer 顶;布局常量、非 worklet,真机按观感可调)。
const SIDE_RAIL_LIFT = r(1);

// absolute 浮层的层级意图:footer 必须最高(始终可点)→ sideRail → zoomChips/watermark。
const Z = { overlay: 7, sideRail: 9, footer: 10 };
const CAMERA_DEVICE_FILTER: DeviceFilter = {
  physicalDevices: ['ultra-wide-angle', 'wide-angle'],
};
const ZERO_VIEWPORT: CameraViewport = { width: 0, height: 0 };

type Props = {
  sessionId: number;
  fileRegistry: FileRegistry;
  registerContainer: RegisterSessionContainer;
  registerController: RegisterSessionController;
  config: OpenConfig;
  onSettle: (r: CameraResult) => void;
};

const UNCONFIGURED_NATIVE_KEY = 'unconfigured';

export function Container({
  sessionId,
  fileRegistry,
  registerContainer,
  registerController,
  config,
  onSettle,
}: Props) {
  // 本地弹窗:切模式/放弃拍摄的二次确认走相机 Modal 内部 host(见 ui/CameraDialogHost),
  // 不走 design 全局 confirm —— 后者会被相机 Modal 盖住。showError 同源(顶部非阻塞错误条)。
  const { confirm, showError } = useCameraDialog();
  const styles = useThemedStyles(makeStyles);
  // App 前后台:切后台时停取景(对齐官方 isActive=isAppActive&&isScreenFocused)。
  const appActive = useAppActive();

  useEffect(() => {
    return registerContainer(sessionId);
  }, [registerContainer, sessionId]);

  const state = usePermissionFlow();

  const insets = useSafeAreaInsets();
  // 初始 requested 前/后摄由 config 首个 mode 的 type 决定(H5 传入),缺省 back。
  // requested 只表示用户意图；actual device/position 统一由 selectCameraDevice 给出。
  // 两个 hook 每次 render 固定按 back/front 调用，缺一侧时才能可靠 fallback 到另一侧，
  // 也避免 requested 改变后违反 Hooks 顺序或把「该侧缺失」误判成「整机无相机」。
  // 5.x：physicalDevices 字符串不带 -camera。请求 ultra-wide-angle + wide-angle
  // 换取 0.5x 超广角档(0.5x 的「用户倍数」经下方 displayMul 转换,见 useZoomController;不是 minZoom≤0.5)。
  // physicalDevices 是 best-match 排序、非硬过滤(vision-camera 文档:「filter
  // never excludes cameras」):不支持超广角的机型会自动 fallback 到 wide-angle
  // (minZoom=1、无 0.5x 但照常工作),不会因缺超广角而 device==null；只有 back/front
  // inventory 都为空时 selection 才为 null，并由下方 NoCamera(code 404)兜底。
  // 历史上单 'wide-angle' 为规避 iOS #3773,启用超广角后需真机验证不复现。
  const firstMode = config.cameraMode[0];
  const initialPosition = firstMode?.type ?? 'back';
  const [requestedPosition, setRequestedPosition] = useState<'back' | 'front'>(
    initialPosition
  );
  const backDevice = useCameraDevice('back', CAMERA_DEVICE_FILTER);
  const frontDevice = useCameraDevice('front', CAMERA_DEVICE_FILTER);
  const selection = useMemo(
    () => selectCameraDevice(requestedPosition, backDevice, frontDevice),
    [backDevice, frontDevice, requestedPosition]
  );
  // inventory selection 是 pending 候选；Camera/metadata 只消费 controller 已接受的
  // committed selection。否则 capture/record/preview 期间设备清单变化会先改 native props，
  // reducer 却拒绝 BEGIN_CONFIGURATION，形成「native 已换、状态仍是旧设备」的撕裂。
  const [committedSelection, setCommittedSelection] = useState(selection);
  const committedSelectionRef = useRef(committedSelection);
  const device = committedSelection?.device;

  // 变焦控制器:vzf↔display 推导、zoom state/shared、设备切换 clamp 全在 hook 内。
  // zoom 显示全程走 UI 线程 zoomShared(pinch 不刷 state);setZoom 仅点击档/手势结束/设备切换回写。
  const { zoom, setZoom, zoomShared, displayMul, minDisplay, maxDisplay } =
    useZoomController(device);

  const cameraRef = useRef<CameraHandle>(null);
  const video = useVideoTransaction({
    cameraRef,
    fileRegistry,
    onError: showError,
  });
  const initialNativeConfigurationKey =
    committedSelection == null || firstMode == null
      ? UNCONFIGURED_NATIVE_KEY
      : nativeConfigurationKey({
          device: {
            id: committedSelection.device.id,
            position: committedSelection.activePosition,
          },
          mode: firstMode,
          aspectRatio: '16:9',
          photoQualityPrioritization: config.photoQualityPrioritization,
          photoHDR: config.photoHDR,
          videoBitRate: config.videoBitRate,
        });
  const controller = useCameraSessionController({
    sessionId,
    initialState: {
      files: [],
      modeIndex: 0,
      aspectRatio: '16:9',
      activePosition: committedSelection?.activePosition ?? initialPosition,
      canFlip: committedSelection?.canFlip ?? false,
      flash: firstMode?.flashMode ?? 'off',
      sound: false,
      nativeConfigurationKey: initialNativeConfigurationKey,
    },
    registerController,
    confirm,
    cancelRecording: video.cancel,
    onSettle,
  });
  const photo = usePhotoCaptureTransaction({
    sessionId,
    cameraRef,
    controller,
    fileRegistry,
    config,
    onError: showError,
  });
  const {
    state: session,
    capabilities,
    beginConfiguration,
    configured,
  } = controller;
  const currentMode = config.cameraMode[session.modeIndex];
  const { files: photos, aspectRatio, flash, sound, preview } = session;
  const recording =
    session.phase === 'recording' || session.phase === 'stoppingVideo';
  const recSeconds = Math.floor(session.video.duration);

  const configurationKeyFor = useCallback(
    (
      nextSelection: SelectedCameraDevice,
      mode: CameraMode,
      nextAspectRatio = aspectRatio
    ) =>
      nativeConfigurationKey({
        device: {
          id: nextSelection.device.id,
          position: nextSelection.activePosition,
        },
        mode,
        aspectRatio: nextAspectRatio,
        photoQualityPrioritization: config.photoQualityPrioritization,
        photoHDR: config.photoHDR,
        videoBitRate: config.videoBitRate,
      }),
    [
      aspectRatio,
      config.photoHDR,
      config.photoQualityPrioritization,
      config.videoBitRate,
    ]
  );

  // pending selection 的 actual position / canFlip 与 native identity 一起原子提交；
  // requested 从不进入 native key 或 metadata。phase 不允许配置时保留 pending，等回到
  // ready/configuring 再重试。即使 id/position 相同，新的 CameraDevice object 也可能触发
  // VisionCamera native reconfigure，故必须强制新 generation。
  useLayoutEffect(() => {
    const previous = committedSelectionRef.current;
    if (selection == null) {
      if (previous == null) return;
      const generation = beginConfiguration(UNCONFIGURED_NATIVE_KEY, {
        canFlip: false,
      });
      if (generation == null) return;

      // 忙态先保留仍在使用的 handle；一旦 controller 接受 unconfigured generation，
      // 同步摘掉失效 device。旧 native completion 带旧 generation，无法恢复 ready。
      committedSelectionRef.current = null;
      setCommittedSelection(null);
      return;
    }
    if (currentMode == null) return;

    const generation = beginConfiguration(
      configurationKeyFor(selection, currentMode),
      {
        activePosition: selection.activePosition,
        canFlip: selection.canFlip,
      },
      previous != null && previous.device !== selection.device
    );
    if (generation == null || previous === selection) return;

    committedSelectionRef.current = selection;
    setCommittedSelection(selection);
  }, [
    beginConfiguration,
    configurationKeyFor,
    currentMode,
    selection,
    session.phase,
  ]);

  const applyMode = (nextIndex: number): void => {
    const nextMode = config.cameraMode[nextIndex];
    if (nextMode == null || committedSelection == null) return;
    beginConfiguration(configurationKeyFor(committedSelection, nextMode), {
      modeIndex: nextIndex,
    });
  };

  const onSelectMode = async (nextIndex: number): Promise<void> => {
    if (
      !capabilities.mode ||
      nextIndex === session.modeIndex ||
      config.cameraMode[nextIndex] == null
    ) {
      return;
    }
    if (config.dataRetainedMode === 'clear' && photos.length > 0) {
      const accepted = await confirm({
        title: '切换拍摄模式',
        message: '切换后将清空已拍内容,是否继续?',
      });
      if (!accepted || !photo.clearForModeSwitch()) return;
    }
    applyMode(nextIndex);
  };

  const onChangeAspectRatio = (nextAspectRatio: '4:3' | '16:9'): void => {
    if (
      !capabilities.aspect ||
      currentMode == null ||
      committedSelection == null
    ) {
      return;
    }
    beginConfiguration(
      configurationKeyFor(committedSelection, currentMode, nextAspectRatio),
      {
        aspectRatio: nextAspectRatio,
      }
    );
  };

  const onFlip = (): void => {
    if (!capabilities.flip) return;
    setRequestedPosition((position) =>
      position === 'back' ? 'front' : 'back'
    );
  };

  const onShutter = (): void => {
    if (currentMode?.mode !== 'video') {
      photo.capturePhoto().catch(() => {});
      return;
    }
    if (session.phase === 'recording') {
      video.stop();
      return;
    }
    if (session.phase === 'stoppingVideo') return;
    const token = controller.beginVideo();
    if (token != null) {
      video.start(token, controller).catch(() => {});
    }
  };

  // footer 高度 onLayout 实测,驱动浮层(sideRail/zoomChips)的 bottom;初值用估值防首帧跳动。
  const [footerHeight, setFooterHeight] = useState(FOOTER_FALLBACK);
  const [viewport, setViewport] = useState<CameraViewport>(ZERO_VIEWPORT);
  const frame = useMemo(
    () => fitCameraFrame(viewport, aspectRatio),
    [aspectRatio, viewport]
  );
  const frameReady = frame.width > 0 && frame.height > 0;
  const onViewportLayout = useCallback((event: LayoutChangeEvent): void => {
    const { width, height } = event.nativeEvent.layout;
    setViewport((current) =>
      current.width === width && current.height === height
        ? current
        : { width, height }
    );
  }, []);

  if (state === 'denied') {
    return (
      <NoPermission
        onCancel={() =>
          controller.settle({
            code: 403,
            data: [],
            message: 'permission_denied',
          })
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

  if (committedSelection == null) {
    return (
      <NoCamera
        onCancel={() =>
          controller.settle({ code: 404, data: [], message: 'no_device' })
        }
      />
    );
  }

  if (currentMode == null) {
    return (
      <NoCamera
        onCancel={() =>
          controller.settle({
            code: 500,
            data: [],
            message: 'invalid_config',
          })
        }
      />
    );
  }

  const modeItems: ModeItem[] = config.cameraMode.map((m, i) => ({
    key: `${m.mode}-${i}`,
    label: MODE_LABEL[m.mode],
  }));

  return (
    <View
      style={styles.root}
      testID="camera-viewport"
      onLayout={onViewportLayout}
    >
      {!frameReady ? (
        <View style={styles.layoutPending} testID="layout-pending">
          <Loading />
        </View>
      ) : (
        <View style={styles.ready} testID="device-ready">
          <AnimatedCameraFrame frame={frame}>
            {(animatedFrame) => (
              <>
                {/* 取景铺满整屏 → 画面相对整屏垂直居中(上下黑边对称,系统相机式布局)。
                    控件全部 absolute 浮在取景之上,所以这里不再用纵向 flex 分割。 */}
                <Camera
                  ref={cameraRef}
                  device={committedSelection.device}
                  currentMode={currentMode}
                  frame={frame}
                  animatedFrame={animatedFrame}
                  // 取景仅在 App 前台且非烧录/预览态时活。Preview 作为覆盖层保留已配置
                  // Camera，返回/重拍/删末张后无需等待一次新的 native attach/configure。
                  isActive={appActive && !photo.burning && preview == null}
                  // 烧水印期间盖刚拍原图防黑屏(isActive=false 取景已停,被它盖住);见顺滑回看 spec。
                  frozenUri={photo.freezeUri}
                  flash={flash}
                  aspectRatio={aspectRatio}
                  zoomShared={zoomShared}
                  // 前摄定焦 → 关 pinch(只留点击对焦),与下方「前置不渲染变焦档」一致。
                  enableZoom={
                    capabilities.zoom && session.activePosition === 'back'
                  }
                  enableFocus={capabilities.focus}
                  // pinch 放大软上限(vzf):maxDisplay 已并入 SOFT_MAX_DISPLAY,÷displayMul 回 vzf。
                  softMaxZoom={maxDisplay / displayMul}
                  // pinch 结束回写一次 JS 侧 zoom(vzf):供设备切换 clamp 基准,不 pinch 全程回写(性能)。
                  onZoomEnd={setZoom}
                  sound={sound}
                  // 拍摄质量参数从 OpenConfig 透传;三者缺省 undefined → Camera 内按需加键、不传则走 SDK 默认。
                  photoQualityPrioritization={config.photoQualityPrioritization}
                  photoHDR={config.photoHDR}
                  videoBitRate={config.videoBitRate}
                  // session 出错 → 顶部非阻塞错误条(showError 自带去抖,可恢复错误连发不刷屏)。
                  // 绝不 settle(500):onError 含可恢复瞬时错误,误当致命会让重开报错关闭(见 Camera.tsx)。
                  onCameraError={(e) =>
                    showError(e?.message || '相机会话异常,请重试')
                  }
                  configurationGeneration={session.configurationGeneration}
                  onConfigured={() =>
                    configured(session.configurationGeneration)
                  }
                />

                {!recording && config.watermark && (
                  <View
                    style={styles.watermark}
                    pointerEvents="none"
                    testID="watermark-wrapper"
                  >
                    {/* 同一 frame + 同一组 SharedValue，目标与 250ms 过渡都严格同框。 */}
                    <WatermarkStamp
                      watermark={config.watermark}
                      frame={frame}
                      animatedFrame={animatedFrame}
                    />
                  </View>
                )}
              </>
            )}
          </AnimatedCameraFrame>

          {!recording && (
            <View
              style={[
                styles.sideRail,
                { bottom: footerHeight + SIDE_RAIL_LIFT },
              ]}
            >
              <SideRail
                flash={flash}
                aspectRatio={aspectRatio}
                sound={sound}
                disabled={!capabilities.aspect}
                onChangeFlash={(nextFlash) => controller.setFlash(nextFlash)}
                onChangeAspectRatio={onChangeAspectRatio}
                onToggleSound={() => controller.setSound(!sound)}
              />
              <SideActions
                canSave={capabilities.save}
                backDisabled={!capabilities.userCancel}
                onBack={controller.requestUserCancel}
                onSave={photo.save}
              />
            </View>
          )}

          {/* 前置(front)不渲染变焦档:前摄定焦、变焦无意义且 0.5x 不存在;切回后置恢复显示。
          ZoomChips = 0.5/1 档位药丸(点击跳档,高亮当前档;高亮档文字实时显示倍数)。
          变焦本身由 Camera 的双指 pinch 写 zoomShared 驱动(见 Camera.tsx)。 */}
          {!recording && session.activePosition === 'back' && (
            <View
              style={[styles.zoomChips, { bottom: footerHeight + CONTROL_GAP }]}
            >
              <ZoomChips
                zoomShared={zoomShared}
                displayMul={displayMul}
                displayZoom={zoom * displayMul}
                // 0.5 档仅超广角机型有:设备最广(minDisplay)≤ 0.5x 才渲染(±1e-3 容浮点漂移)。
                showHalf={minDisplay <= 0.5 + 1e-3}
                disabled={!capabilities.zoom}
                onSelect={(displayZ) => {
                  if (!capabilities.zoom) return;
                  // 点击档:边界用 display 空间,内部 zoom/zoomShared 仍是 vzf。
                  // display → vzf 反算(÷displayMul)再 clamp 回设备 vzf 范围。
                  const vzf = clamp(
                    displayZ / displayMul,
                    committedSelection.device.minZoom,
                    committedSelection.device.maxZoom
                  );
                  setZoom(vzf);
                  zoomShared.value = vzf;
                }}
              />
            </View>
          )}

          {/* 「生成中」遮罩仅在**有水印**时显示:无水印纯裁切(16:9)只靠定格帧画面定一下、不弹文字遮罩,
          更接近系统相机「拍照回看」、不突兀(用户反馈)。定格帧本身(Camera frozenUri)防黑屏不变。
          footer 不再整段替换(模式药丸恒定,不卸载 → 不跳档)。 */}
          {photo.burning && config.watermark != null && (
            <View
              style={styles.burningOverlay}
              pointerEvents="none"
              testID="burning"
            >
              {/* 半透明黑玻璃卡片托住 spinner+文字:浮在任意照片上都清晰、更精致(系统相机式 loading)。 */}
              <View style={styles.burningCard}>
                <Loading size={r(40)} color="#fff" thickness={r(3)} />
                <Text style={styles.burningText}>水印生成中…</Text>
              </View>
            </View>
          )}

          <CaptureFlash trigger={photo.flashNonce} />

          <View
            style={[styles.bottom, { paddingBottom: insets.bottom + r(1) }]}
            onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
          >
            {recording ? (
              <View style={styles.center}>
                <RecordingTimer seconds={recSeconds} />
              </View>
            ) : (
              <View style={styles.center}>
                <ModeSwitcherPill
                  items={modeItems}
                  currentIndex={session.modeIndex}
                  disabled={!capabilities.mode}
                  onSelect={onSelectMode}
                />
              </View>
            )}
            <ActionRow
              mode={currentMode.mode}
              recording={recording}
              shutterDisabled={!capabilities.capture}
              flipDisabled={!capabilities.flip}
              galleryDisabled={!capabilities.gallery}
              latestUri={photos.at(-1)?.uri}
              count={photos.length}
              onShutter={onShutter}
              onFlip={onFlip}
              onOpenPreview={photo.openGallery}
            />
          </View>
        </View>
      )}
      {preview != null && (
        <PreviewOverlay
          files={photos}
          variant={preview.variant}
          onRetake={photo.retake}
          onSave={photo.save}
          onBack={photo.closePreview}
          onDelete={photo.deletePhoto}
        />
      )}
    </View>
  );
}

const makeStyles = (c: ColorTokens) =>
  StyleSheet.create({
    // 相机主容器固定黑底:相机 UX 惯例(取景物理常量),不走 c.background token。
    // position:relative → 内部 absolute 浮层(footer/sideRail/zoomChips)以整屏为参照。
    root: { flex: 1, backgroundColor: VIEWFINDER.black, position: 'relative' },
    ready: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
    layoutPending: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // wrapper 只提供与 Camera 相同的 viewport 坐标系；精确 rect 由显式 frame
    // 交给 WatermarkStamp，不在这里再次预算或居中。
    watermark: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
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
    // footer 整体贴底:paddingBottom 只留 home-indicator 间距(见 JSX insets.bottom+r(1)),
    // paddingTop 取小值让 footer 更贴底;gap = 模式行(单拍/连拍)与快门行的间距,取小值让模式行贴近快门。
    bottom: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: r(2),
      gap: r(10),
      backgroundColor: 'transparent',
      zIndex: Z.footer,
    },
    center: { alignItems: 'center' },
    // 「生成中」覆盖层:绝对铺满、居中,盖在取景(被定格帧盖住的画面)之上、footer 之下。
    burningOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: Z.overlay,
    },
    // 半透明黑玻璃卡片:托住 spinner+文字,任意照片上清晰、有质感(底色物理常量见 viewfinder)。
    burningCard: {
      alignItems: 'center',
      gap: r(14),
      paddingVertical: r(24),
      paddingHorizontal: r(36),
      borderRadius: r(18),
      backgroundColor: VIEWFINDER.loadingCard,
    },
    // 文字加大(t.sm→t.body)+ 中等字重,比原来更醒目。
    burningText: {
      color: c.foreground,
      fontSize: t.body,
      fontWeight: fw.medium,
    },
  });
