import { StyleSheet, TouchableOpacity } from 'react-native';
import { GlassLayer, Icon, r, useColors } from '@unif/react-native-design';
import { VIEWFINDER } from '../colors/viewfinder';

export function FlipButton({
  disabled = false,
  onFlip,
}: {
  disabled?: boolean;
  onFlip: () => void;
}) {
  const c = useColors();
  return (
    <TouchableOpacity
      testID="flip-btn"
      onPress={onFlip}
      disabled={disabled}
      style={styles.btn}
      accessibilityRole="button"
      accessibilityLabel="切换前后摄像头"
      accessibilityState={{ disabled }}
    >
      <GlassLayer
        testID="flip-glass"
        effect="clear"
        tintColor={VIEWFINDER.glassPill}
        style={styles.glass}
      />
      {/* camera-flip(相机机身 + 机内循环箭头)= 系统相机「前后摄切换」通用形态,
          比抽象的 lens-flip(圆镜头 + 环绕弧箭头)更直白;机内箭头细小,size 给 r(22) 保清晰。 */}
      <Icon name="camera-flip" size={r(22)} color={c.foreground} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  glass: { borderRadius: r(22) },
  btn: {
    width: r(44),
    height: r(44),
    borderRadius: r(22),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
