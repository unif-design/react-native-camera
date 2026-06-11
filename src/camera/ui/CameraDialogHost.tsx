import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  Icon,
  useColors,
  r,
  fw,
  type as t,
} from '@unif/react-native-design';

// 同一条错误的去抖窗口:可恢复的 session 错误会在重启时连发同一 message,
// 短时间内重复弹会刷屏。同 message 且距上次 < 该窗口则静默丢弃。
const ERROR_DEDUPE_MS = 5000;
// 错误条自动消失:4s 后滑回(用户也可手动 ✕ 立即关)。
const ERROR_AUTO_DISMISS_MS = 4000;

type ConfirmOpts = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type Ctx = {
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  toast: (msg: string) => void;
  showError: (msg: string) => void;
};

const DialogCtx = createContext<Ctx | null>(null);

export const useCameraDialog = () => {
  const c = useContext(DialogCtx);
  if (!c)
    throw new Error('useCameraDialog must be used within CameraDialogProvider');
  return c;
};

/**
 * 相机 Modal 内部本地弹窗系统。
 *
 * Why 不走 design 全局 confirm/toast:相机是 RN <Modal>,design 的
 * ConfirmHost/ToastHost 挂在消费者 App 根,App 根的 Modal/View 无法叠在
 * 已 present 的相机 Modal 之上 → 相机内的确认/删除/放弃弹窗、"已保存" toast
 * 全被相机 Modal 盖住。这里用 absolute overlay(非 RN Modal,因为已在相机
 * Modal 内,高 zIndex absoluteFill + 半透明遮罩即可)渲染在相机 Modal 子树内,
 * 正常显示在相机之上;半透明遮罩(c.scrim)同时解决"背景全黑"。
 */
export function CameraDialogProvider({ children }: { children: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [entry, setEntry] = useState<
    (ConfirmOpts & { resolve: (b: boolean) => void }) | null
  >(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 顶部错误条:与底部 toast 区分(toast 是成功类轻提示,error 是 session 异常告警)。
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 去抖记账:记上一条 message 与时刻,同 message 在 ERROR_DEDUPE_MS 内不重复弹。
  // 普通 RN 组件(非 worklet),Date.now() 可用。
  const lastErrorMsg = useRef<string | null>(null);
  const lastErrorAt = useRef(0);
  // 滑出/淡出:0=完全隐藏(上移到条外+透明),1=完全显示。
  const errorAnim = useSharedValue(0);

  // Single-flight:调用方都是 await 串行使用。若并发调用,后一个 setEntry 会
  // 覆盖前一个,前一个的 Promise 永不 resolve(当前用法不会发生此情况)。
  const confirm = useCallback(
    (o: ConfirmOpts) =>
      new Promise<boolean>((resolve) => setEntry({ ...o, resolve })),
    []
  );
  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2000);
  }, []);

  // 错误条收起:反向滑出 + 淡出后清空 message(动画用 withTiming,无 worklet/JS 桥回调
  // 依赖 —— 直接清 state 卸载即可,reanimated 桩在 jest 下 withTiming 同步返回值,逻辑可测)。
  const dismissError = useCallback(() => {
    if (errorTimer.current) {
      clearTimeout(errorTimer.current);
      errorTimer.current = null;
    }
    errorAnim.value = withTiming(0, { duration: 180 });
    setErrorMsg(null);
  }, [errorAnim]);

  const showError = useCallback(
    (msg: string) => {
      // 去抖:同 message 且距上次 < ERROR_DEDUPE_MS 直接丢弃(可恢复错误连发不刷屏);
      // 不同 message 或已超窗口才弹。
      const now = Date.now();
      if (
        msg === lastErrorMsg.current &&
        now - lastErrorAt.current < ERROR_DEDUPE_MS
      ) {
        return;
      }
      lastErrorMsg.current = msg;
      lastErrorAt.current = now;
      setErrorMsg(msg);
      errorAnim.value = withTiming(1, { duration: 220 });
      // 重复触发先清旧定时器,再排 4s 自动消失(到点复用 dismissError 的收起逻辑,不重复实现)。
      if (errorTimer.current) clearTimeout(errorTimer.current);
      errorTimer.current = setTimeout(dismissError, ERROR_AUTO_DISMISS_MS);
    },
    [errorAnim, dismissError]
  );

  // 卸载时清掉 toast / error 定时器,避免对已卸载组件 setState。
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (errorTimer.current) clearTimeout(errorTimer.current);
    },
    []
  );

  // 错误条滑入/滑出:从顶部 translateY(-100%→0,以条高 ~errorSlideY 近似)+ 透明度联动。
  // r(56) 必须在 worklet 外预算 —— design 的 r() 是 JS(Remote)函数,在 useAnimatedStyle
  // 的 UI-runtime worklet 里直接调用会触发 worklets「同步调用 Remote Function」fatal 错误
  // (切换倍数等频繁重渲染时尤为明显)。捕获成数字常量后 worklet 内只用值,不跨 runtime 调用。
  const errorSlideY = r(56);
  const errorBarStyle = useAnimatedStyle(() => ({
    opacity: errorAnim.value,
    transform: [{ translateY: (errorAnim.value - 1) * errorSlideY }],
  }));

  const close = useCallback(
    (b: boolean) => {
      entry?.resolve(b);
      setEntry(null);
    },
    [entry]
  );

  return (
    <DialogCtx.Provider value={{ confirm, toast, showError }}>
      {children}
      {entry && (
        <View style={styles.overlay} testID="camera-confirm">
          <Pressable
            style={[styles.backdrop, { backgroundColor: c.scrim }]}
            onPress={() => close(false)}
            accessibilityRole="button"
            accessibilityLabel="关闭"
            testID="camera-confirm-backdrop"
          />
          <View style={[styles.sheet, { backgroundColor: c.surface }]}>
            <Text style={[styles.title, { color: c.foreground }]}>
              {entry.title}
            </Text>
            {entry.message ? (
              <Text style={[styles.msg, { color: c.foregroundMuted }]}>
                {entry.message}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Button
                label={entry.cancelLabel ?? '取消'}
                variant="secondary"
                block
                onPress={() => close(false)}
                testID="camera-confirm-cancel"
              />
              <Button
                label={entry.confirmLabel ?? '确认'}
                variant={entry.destructive ? 'danger' : 'primary'}
                block
                onPress={() => close(true)}
                testID="camera-confirm-ok"
              />
            </View>
          </View>
        </View>
      )}
      {toastMsg ? (
        <View
          style={styles.toastWrap}
          pointerEvents="none"
          testID="camera-toast"
        >
          <Text
            style={[
              styles.toast,
              { color: c.foreground, backgroundColor: c.scrim },
            ]}
          >
            {toastMsg}
          </Text>
        </View>
      ) : null}
      {errorMsg ? (
        <Animated.View
          style={[styles.errorWrap, { top: insets.top + r(8) }, errorBarStyle]}
          testID="camera-error-bar"
        >
          {/* 错误条配色:c.error 红底 + c.foreground 白字(取景上最醒目的告警信号);
              相机 forceScheme=dark,token 恒为深色态。 */}
          <View style={[styles.errorBar, { backgroundColor: c.error }]}>
            <Icon name="warning" size={r(18)} color={c.foreground} />
            <Text
              style={[styles.errorText, { color: c.foreground }]}
              numberOfLines={1}
            >
              相机异常:{errorMsg}
            </Text>
            <Pressable
              onPress={dismissError}
              hitSlop={r(8)}
              accessibilityRole="button"
              accessibilityLabel="关闭错误提示"
              testID="camera-error-close"
            >
              <Icon name="close" size={r(18)} color={c.foreground} />
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
    </DialogCtx.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    padding: r(20),
    borderTopLeftRadius: r(16),
    borderTopRightRadius: r(16),
    gap: r(12),
  },
  title: { fontSize: t.h2, fontWeight: fw.semi },
  msg: { fontSize: t.sm },
  actions: { flexDirection: 'row', gap: r(12), marginTop: r(8) },
  toastWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: r(120),
    alignItems: 'center',
    zIndex: 101,
  },
  // toast 浮在相机/预览深色之上:配色走 dark token —— color=c.foreground(#fff)、
  // 底=c.scrim(rgba(0,0,0,0.7))。相机 Modal forceScheme="dark" 恒为深色胶囊,
  // 不会在浅色态变浅看不清(color/bg 内联设置,见 JSX)。
  toast: {
    paddingHorizontal: r(16),
    paddingVertical: r(10),
    borderRadius: r(10),
    overflow: 'hidden',
    fontSize: t.sm,
  },
  // 顶部错误条:顶满左右,top 内联接 safe-area。zIndex 高于 toast/sideRail,
  // 但低于 confirm overlay(100)—— 错误条非阻塞,不该盖确认弹窗。
  errorWrap: {
    position: 'absolute',
    left: r(12),
    right: r(12),
    zIndex: 99,
  },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r(8),
    paddingHorizontal: r(14),
    paddingVertical: r(10),
    borderRadius: r(12),
  },
  // flex:1 + numberOfLines=1 → 长 message 单行省略,不撑破横条。
  errorText: { flex: 1, fontSize: t.sm, fontWeight: fw.medium },
});
