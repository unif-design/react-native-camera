import { StyleSheet, TouchableOpacity } from 'react-native';
import {
  Icon,
  r,
  useColors,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';

export function FlipButton({ onFlip }: { onFlip: () => void }) {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity testID="flip-btn" onPress={onFlip} style={styles.btn}>
      {/* camera-flip(相机机身 + 机内循环箭头)= 系统相机「前后摄切换」通用形态,
          比抽象的 lens-flip(圆镜头 + 环绕弧箭头)更直白;机内箭头细小,size 给 r(22) 保清晰。 */}
      <Icon name="camera-flip" size={r(22)} color={c.foreground} />
    </TouchableOpacity>
  );
}

const makeStyles = (c: ColorTokens) =>
  StyleSheet.create({
    btn: {
      width: r(44),
      height: r(44),
      borderRadius: r(22),
      backgroundColor: c.glassPillBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
