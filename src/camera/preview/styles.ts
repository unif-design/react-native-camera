import { StyleSheet } from 'react-native';
import { r, fw, type as t } from '@unif/react-native-design';

// 预览底部走相机黑底,计数文字 / 按钮文字用 foreground token(Modal 强制 dark → 恒白);
// paddingBottom 由组件按底部安全区(home indicator)+ 基础 20 给。
export const makePreviewBottomStyles = () =>
  StyleSheet.create({
    root: {
      paddingHorizontal: r(16),
      paddingTop: r(12),
      gap: r(12),
      alignItems: 'center',
    },
    counter: { fontSize: t.body, fontWeight: fw.semi },
    btns: {
      flexDirection: 'row',
      justifyContent: 'center',
      columnGap: r(40),
    },
    item: { alignItems: 'center', rowGap: r(7) },
    itemDisabled: { opacity: 0.45 },
    circle: {
      // trash(垃圾桶,3 条 stroke)在小尺寸会挤一起糊成一团 → 图标 r(26) 取清晰,
      // 圆盘相应放大到 r(56) 让图标透气(见上 Icon size)。
      width: r(56),
      height: r(56),
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
    },
    label: {
      fontSize: t.xxs,
      fontWeight: fw.medium,
      textShadowColor: 'rgba(0,0,0,0.4)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
  });
