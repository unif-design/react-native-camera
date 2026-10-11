import { Pressable, Text, View } from 'react-native';
import {
  GlassLayer,
  r,
  useColors,
  useThemedStyles,
} from '@unif/react-native-design';
import { makePreviewBottomStyles } from './styles';
import type { PreviewActionButtonProps } from './types';

// 普通操作使用玻璃圆盘；保存和删除保留实色语义，标签位于圆盘外。
export function PreviewActionButton({
  icon: Icon,
  label,
  tone,
  onPress,
  testID,
  disabled = false,
}: PreviewActionButtonProps) {
  const c = useColors();
  const styles = useThemedStyles(makePreviewBottomStyles);
  const bg =
    tone === 'primary' ? c.primary : tone === 'danger' ? c.error : undefined;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={styles.item}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      {({ pressed }) => {
        const opacity = disabled ? 0.45 : pressed ? 0.7 : 1;
        return (
          <>
            <View
              style={[
                styles.circle,
                { backgroundColor: bg, borderColor: c.glassPillBorder },
              ]}
            >
              {tone === 'neutral' && (
                <GlassLayer colorScheme="dark" style={styles.circleGlass} />
              )}
              {/* 玻璃不跟随前景的按压或禁用透明度。 */}
              <View collapsable={false} style={{ opacity }}>
                <Icon size={r(26)} color={c.foreground} />
              </View>
            </View>
            <Text style={[styles.label, { color: c.foreground, opacity }]}>
              {label}
            </Text>
          </>
        );
      }}
    </Pressable>
  );
}
