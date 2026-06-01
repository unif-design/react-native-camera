import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { r } from '@unif/react-native-design';
import { DARK } from '../colors/dark';

type Props = { latestUri?: string; count: number; onPress: () => void };

export function ThumbnailStack({ latestUri, count, onPress }: Props) {
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

const styles = StyleSheet.create({
  wrap: { width: r(44), height: r(44) },
  img: {
    width: r(44),
    height: r(44),
    borderRadius: r(6),
    borderWidth: 2,
    borderColor: DARK.white,
  },
  empty: {
    width: r(44),
    height: r(44),
    borderRadius: r(8),
    borderWidth: 1.5,
    borderColor: DARK.white40,
    backgroundColor: DARK.white08,
  },
  badge: {
    position: 'absolute',
    top: r(-6),
    right: r(-6),
    minWidth: r(20),
    height: r(20),
    borderRadius: r(999),
    backgroundColor: DARK.orange,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: r(4),
  },
  badgeText: { color: DARK.white, fontSize: r(11), fontWeight: '700' },
});
