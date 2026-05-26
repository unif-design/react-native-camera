import { Image, StyleSheet, View } from 'react-native';
import type { CustomPhotoFile } from '../../utils';

type Props = { file: CustomPhotoFile };

export function SinglePre({ file }: Props) {
  return (
    <View style={styles.root} testID="single-pre">
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
