import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { CustomPhotoFile } from '../utils';

type Props = {
  files: CustomPhotoFile[];
  currentIndex: number;
  onTap: (i: number) => void;
};

export function PreviewThumbnail({ files, currentIndex, onTap }: Props) {
  return (
    <View style={styles.row}>
      {files.map((f, i) => (
        <TouchableOpacity key={`${f.path}-${i}`} onPress={() => onTap(i)}>
          <Image
            source={{ uri: f.uri }}
            style={[styles.thumb, i === currentIndex && styles.thumbActive]}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, padding: 8 },
  thumb: { width: 48, height: 48, borderRadius: 4 },
  thumbActive: { borderWidth: 2, borderColor: '#3af' },
});
