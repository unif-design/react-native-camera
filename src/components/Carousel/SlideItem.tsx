import { Image, StyleSheet, View } from 'react-native';
import type { CustomPhotoFile } from '../../utils';

export function SlideItem({ file }: { file: CustomPhotoFile }) {
  return (
    <View style={styles.root}>
      <Image
        source={{ uri: file.uri }}
        style={StyleSheet.absoluteFill}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // 相机 slide 固定黑底:与 SinglePre / PreView 一致,
  // 让照片在纯黑上凸显的 UX 惯例,不走 c.background token.
  root: { flex: 1, backgroundColor: '#000' },
});
