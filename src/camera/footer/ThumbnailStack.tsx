import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  r,
  fw,
  type as t,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';

// 只在「已拍照」(有 latestUri)时渲染:拍照前的空位由 ActionRow 用惰性 slot 占位,
// 不在此显空框 / 死按钮。
type Props = { latestUri: string; count: number; onPress: () => void };

export function ThumbnailStack({ latestUri, count, onPress }: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      testID="thumbnail-stack"
      onPress={onPress}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityLabel="查看已拍照片"
    >
      <Image source={{ uri: latestUri }} style={styles.img} />
      {count > 1 && (
        <View style={styles.badge} testID="thumb-badge">
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const makeStyles = (c: ColorTokens) =>
  StyleSheet.create({
    wrap: { width: r(44), height: r(44) },
    img: {
      width: r(44),
      height: r(44),
      borderRadius: r(6),
      borderWidth: 2,
      borderColor: c.foreground,
    },
    badge: {
      position: 'absolute',
      top: r(-6),
      right: r(-6),
      minWidth: r(20),
      height: r(20),
      borderRadius: r(999),
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: r(4),
    },
    badgeText: { color: c.foreground, fontSize: t.micro, fontWeight: fw.bold },
  });
