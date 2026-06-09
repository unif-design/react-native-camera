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
          // cover = 取景所见:Camera.tsx 取景框 width:100%×aspectRatio + VisionCamera
          // resizeMode="cover"(满宽铺满、按比例裁掉上下超出)。预览这里同样 cover → 与取景
          // 完全一致;裁切是预期(取景就是 cover),不是 contain 的「完整照片 + 左右黑边」。
          resizeMode="cover"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // 相机 slide 固定黑底:让图/视频在纯黑上凸显的 UX 惯例,不走 c.background token.
  root: { flex: 1, backgroundColor: '#000' },
});
