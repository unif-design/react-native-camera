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
import { Button, useColors, r } from '@unif/react-native-design';

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
  const [entry, setEntry] = useState<
    (ConfirmOpts & { resolve: (b: boolean) => void }) | null
  >(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // 卸载时清掉 toast 定时器,避免对已卸载组件 setState。
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  const close = (b: boolean) => {
    entry?.resolve(b);
    setEntry(null);
  };

  return (
    <DialogCtx.Provider value={{ confirm, toast }}>
      {children}
      {entry && (
        <View style={styles.overlay} testID="camera-confirm">
          <Pressable
            style={[styles.backdrop, { backgroundColor: c.scrim }]}
            onPress={() => close(false)}
            accessibilityRole="button"
            accessibilityLabel="关闭"
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
          <Text style={styles.toast}>{toastMsg}</Text>
        </View>
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
  title: { fontSize: r(17), fontWeight: '600' },
  msg: { fontSize: r(14) },
  actions: { flexDirection: 'row', gap: r(12), marginTop: r(8) },
  toastWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: r(120),
    alignItems: 'center',
    zIndex: 101,
  },
  // toast 物理常量级配色(白字黑底半透):toast 浮在相机/预览深色之上,
  // 跟随主题反而会在浅色态变浅看不清,故固定深色胶囊。
  toast: {
    paddingHorizontal: r(16),
    paddingVertical: r(10),
    borderRadius: r(10),
    overflow: 'hidden',
    fontSize: r(14),
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
});
