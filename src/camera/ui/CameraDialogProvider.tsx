import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ConfirmHost,
  confirm as confirmWithDesign,
  Icon,
  r,
  useColors,
  useThemedStyles,
  type ConfirmOptions,
} from '@unif/react-native-design';
import { CameraDialogContext } from './context';
import {
  ERROR_AUTO_DISMISS_MS,
  ERROR_DEDUPE_MS,
  TOAST_AUTO_DISMISS_MS,
} from './constants';
import { makeDialogStyles } from './styles';
import type { CameraDialogProviderProps } from './types';

/** Owns one camera interaction; its nested Design host owns confirmation UI. */
export function CameraDialogProvider({ children }: CameraDialogProviderProps) {
  const c = useColors();
  const styles = useThemedStyles(makeDialogStyles);
  const insets = useSafeAreaInsets();
  const active = useRef(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastErrorMsg = useRef<string | null>(null);
  const lastErrorAt = useRef(0);
  const errorAnim = useSharedValue(0);

  useLayoutEffect(() => {
    active.current = true;
    return () => {
      // Invalidate retained callbacks before the next interaction mounts.
      active.current = false;
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (errorTimer.current) clearTimeout(errorTimer.current);
    };
  }, []);

  const confirm = useCallback(async (options: ConfirmOptions) => {
    if (!active.current) return false;
    const accepted = await confirmWithDesign(options);
    return active.current && accepted;
  }, []);

  const toast = useCallback((message: string) => {
    if (!active.current) return;
    setToastMsg(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      if (active.current) setToastMsg(null);
    }, TOAST_AUTO_DISMISS_MS);
  }, []);

  const dismissError = useCallback(() => {
    if (!active.current) return;
    if (errorTimer.current) {
      clearTimeout(errorTimer.current);
      errorTimer.current = null;
    }
    errorAnim.value = withTiming(0, { duration: 180 });
    setErrorMsg(null);
  }, [errorAnim]);

  const showError = useCallback(
    (message: string) => {
      if (!active.current) return;
      const now = Date.now();
      if (
        message === lastErrorMsg.current &&
        now - lastErrorAt.current < ERROR_DEDUPE_MS
      )
        return;
      lastErrorMsg.current = message;
      lastErrorAt.current = now;
      setErrorMsg(message);
      errorAnim.value = withTiming(1, { duration: 220 });
      if (errorTimer.current) clearTimeout(errorTimer.current);
      errorTimer.current = setTimeout(dismissError, ERROR_AUTO_DISMISS_MS);
    },
    [dismissError, errorAnim]
  );

  // Compute Design dimensions before entering the Reanimated worklet.
  const errorSlideY = r(56);
  const errorBarStyle = useAnimatedStyle(() => ({
    opacity: errorAnim.value,
    transform: [{ translateY: (errorAnim.value - 1) * errorSlideY }],
  }));

  return (
    <CameraDialogContext.Provider value={{ confirm, toast, showError }}>
      {/* Design supports a host inside RN Modal and settles its pending request
          when this interaction ends. Register it before child effects run. */}
      <ConfirmHost />
      {children}
      {/* These nonblocking viewfinder hints stay above capture controls. Camera
          errors also deduplicate repeated native reports within this session. */}
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
          <View style={[styles.errorBar, { backgroundColor: c.error }]}>
            <Icon name="warning" size={r(18)} color={c.foreground} />
            <Text
              style={[styles.errorText, { color: c.foreground }]}
              numberOfLines={1}
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
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
    </CameraDialogContext.Provider>
  );
}
