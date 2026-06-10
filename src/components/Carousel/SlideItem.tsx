import { Image, StyleSheet, View } from 'react-native';
import type { CustomPhotoFile } from '../../utils';
import { VIEWFINDER } from '../../camera/colors/viewfinder';
import { VideoPlayer } from '../VideoPlayer';

export function SlideItem({ file }: { file: CustomPhotoFile }) {
  return (
    <View style={styles.root}>
      {/* 固定灰色画布:外层容器恒定(铺满 slide),4:3/16:9 只是画布内图片比例不同
          (灰边多少不同)—— 不同画幅下预览的「外层观感」一致,不再忽大忽小。 */}
      <View style={styles.canvas} testID="slide-canvas">
        {file.mime === 'video/mp4' ? (
          <VideoPlayer uri={file.uri} />
        ) : (
          <Image
            source={{ uri: file.uri }}
            style={StyleSheet.absoluteFill}
            // contain = 与取景一致(取景也用 contain):完整照片、按比例留边、不裁切。
            resizeMode="contain"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 相机 slide 固定黑底:让图/视频在纯黑上凸显的 UX 惯例,不走 c.background token.
  root: { flex: 1, backgroundColor: '#000' },
  canvas: { flex: 1, backgroundColor: VIEWFINDER.previewCanvas },
});
