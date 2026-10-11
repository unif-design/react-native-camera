import { CameraFlipOutlined } from '@unif/react-native-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { GlassLayer, r, useColors } from '@unif/react-native-design';

export function FlipButton({
  disabled = false,
  onFlip,
}: {
  disabled?: boolean;
  onFlip: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      testID="flip-btn"
      onPress={onFlip}
      disabled={disabled}
      style={styles.btn}
      accessibilityRole="button"
      accessibilityLabel="切换前后摄像头"
      accessibilityState={{ disabled }}
    >
      {({ pressed }) => (
        <>
          <GlassLayer
            testID="flip-glass"
            colorScheme="dark"
            style={styles.glass}
          />
          {/* 原生材质的祖先保持不透明，按压只淡化图标。 */}
          <View collapsable={false} style={pressed && styles.iconPressed}>
            <CameraFlipOutlined size={r(22)} color={c.foreground} />
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glass: { borderRadius: r(22) },
  iconPressed: { opacity: 0.2 },
  btn: {
    width: r(44),
    height: r(44),
    borderRadius: r(22),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
