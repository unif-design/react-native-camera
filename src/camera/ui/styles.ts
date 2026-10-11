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
    // 材质固定深色，平台及减少透明度回退由 Design 提供。
    toast: {
      paddingHorizontal: r(16),
      paddingVertical: r(10),
      borderRadius: r(10),
      overflow: 'hidden',
    },
    toastGlass: { borderRadius: r(10) },
    toastText: { fontSize: t.sm },
    // 顶部错误条接 safe-area；Design 确认使用上层 native Modal。
    errorWrap: {
      position: 'absolute',
      left: r(12),
      right: r(12),
      zIndex: 99,
    },
    errorBar: {
      paddingHorizontal: r(14),
      paddingVertical: r(10),
      borderRadius: r(12),
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
    },
    errorGlass: { borderRadius: r(12) },
    errorContent: { flexDirection: 'row', alignItems: 'center', gap: r(8) },
    // flex:1 + numberOfLines=1 → 长 message 单行省略,不撑破横条。
    errorText: { flex: 1, fontSize: t.sm, fontWeight: fw.medium },
  });
