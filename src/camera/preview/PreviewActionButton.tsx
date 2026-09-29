import { Pressable, Text, View } from 'react-native';
import { Icon, r, useColors, useThemedStyles } from '@unif/react-native-design';
import { makePreviewBottomStyles } from './styles';
import type { PreviewActionButtonProps } from './types';

// 扫一扫式「上 icon 下文字」圆形按钮:圆形实色图标盘 + 下方标签。
// tone 决定圆底色:primary=橙(c.primary)、danger=红(c.error)、neutral=半透明浅灰白
// (c.glassHighlight dark=rgba(255,255,255,0.24))—— 预览黑底上要可见,与橙对称;
// 不再用 VIEWFINDER.glassPill 黑底(在黑底预览上几乎看不见)。
export function PreviewActionButton({
  icon,
  label,
  tone,
  onPress,
  testID,
  disabled = false,
}: PreviewActionButtonProps) {
  const c = useColors();
  const styles = useThemedStyles(makePreviewBottomStyles);
  const bg =
    tone === 'primary'
      ? c.primary
      : tone === 'danger'
        ? c.error
        : c.glassHighlight;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.item,
        pressed && { opacity: 0.7 },
        disabled && styles.itemDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <View
        style={[
          styles.circle,
          { backgroundColor: bg, borderColor: c.glassPillBorder },
        ]}
      >
        <Icon name={icon} size={r(26)} color={c.foreground} />
      </View>
      <Text style={[styles.label, { color: c.foreground }]}>{label}</Text>
    </Pressable>
  );
}
