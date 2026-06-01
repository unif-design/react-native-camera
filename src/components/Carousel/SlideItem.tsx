import { Image, StyleSheet, View } from 'react-native';
import type { CustomPhotoFile } from '../../utils';
import { VideoPlayer } from '../VideoPlayer';

export function SlideItem({ file }: { file: CustomPhotoFile }) {
  return (
    <View style={styles.root}>
      {file.mime === 'video/mp4' ? (
        <VideoPlayer uri={file.uri} />
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
  // 相机 slide 固定黑底:让图/视频在纯黑上凸显的 UX 惯例,不走 c.background token.
  root: { flex: 1, backgroundColor: '#000' },
});
