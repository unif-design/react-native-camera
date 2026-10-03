import { StyleSheet } from 'react-native';
import { r, fw, type as t } from '@unif/react-native-design';

export const makeDialogStyles = () =>
  StyleSheet.create({
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
    // 顶部错误条接 safe-area；Design 确认使用上层 native Modal。
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
