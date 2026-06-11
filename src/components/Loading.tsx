import { StyleSheet, View } from 'react-native';
import { Spinner, r } from '@unif/react-native-design';

// size/color/thickness 可选:缺省走 Spinner 默认(c.primary 主橙,权限 pending 全屏 loading 用);
// 烧水印覆盖层显式传白色 + 加大加粗,在半透明黑卡片上更清晰(见 Container burningCard)。
export function Loading({
  size,
  color,
  thickness,
}: { size?: number; color?: string; thickness?: number } = {}) {
  return (
    <View style={styles.root} testID="loading">
      <Spinner size={size ?? r(32)} color={color} thickness={thickness} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { justifyContent: 'center', alignItems: 'center' },
});
