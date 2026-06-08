import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  r,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';

type Props = { latestUri?: string; count: number; onPress: () => void };

export function ThumbnailStack({ latestUri, count, onPress }: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      testID="thumbnail-stack"
      onPress={onPress}
      style={styles.wrap}
    >
      {latestUri ? (
        <Image source={{ uri: latestUri }} style={styles.img} />
      ) : (
        <View style={styles.empty} />
      )}
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
    empty: {
      width: r(44),
      height: r(44),
      borderRadius: r(8),
      borderWidth: 1.5,
      borderColor: c.foregroundSubtle,
      backgroundColor: c.glassSeparator,
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
    badgeText: { color: c.foreground, fontSize: r(11), fontWeight: '700' },
  });
