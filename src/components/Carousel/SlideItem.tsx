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
  root: { flex: 1, backgroundColor: 'black' },
});
