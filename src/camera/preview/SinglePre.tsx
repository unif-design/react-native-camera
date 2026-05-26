import { Image, StyleSheet, Text, View } from 'react-native';
import type { CustomPhotoFile } from '../../utils';

type Props = { file: CustomPhotoFile };

export function SinglePre({ file }: Props) {
  return (
    <View style={styles.root} testID="single-pre">
      {file.mime === 'video/mp4' ? (
        <View style={styles.videoStub}>
          <Text style={styles.videoText}>
            视频 · {file.duration?.toFixed(1)}s
          </Text>
          <Text style={styles.videoPath}>{file.path}</Text>
        </View>
      ) : (
        <Image
          source={{ uri: file.uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'black' },
  videoStub: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  videoText: { color: 'white', fontSize: 22, marginBottom: 8 },
  videoPath: { color: '#888', fontSize: 12 },
});
