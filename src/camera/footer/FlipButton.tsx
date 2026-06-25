import { StyleSheet, TouchableOpacity } from 'react-native';
import { Icon, r, useColors } from '@unif/react-native-design';
import { VIEWFINDER } from '../colors/viewfinder';

export function FlipButton({ onFlip }: { onFlip: () => void }) {
  const c = useColors();
  return (
    <TouchableOpacity
      testID="flip-btn"
      onPress={onFlip}
      style={styles.btn}
      accessibilityRole="button"
      accessibilityLabel="切换前后摄像头"
    >
      {/* camera-flip(相机机身 + 机内循环箭头)= 系统相机「前后摄切换」通用形态,
          比抽象的 lens-flip(圆镜头 + 环绕弧箭头)更直白;机内箭头细小,size 给 r(22) 保清晰。 */}
      <Icon name="camera-flip" size={r(22)} color={c.foreground} />
    </TouchableOpacity>
  );
}

// 背景用取景物理常量 VIEWFINDER.glassPill(半透明黑):控件浮在明亮实拍画面上,
// design 的 glass token 是半透明白(给深色界面用),在亮画面上几乎不可见。
const styles = StyleSheet.create({
  btn: {
    width: r(44),
    height: r(44),
    borderRadius: r(22),
    backgroundColor: VIEWFINDER.glassPill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
