import { Image, StyleSheet, View } from 'react-native';
import type { CustomPhotoFile } from '../../utils';
import { VideoPlayer } from '../VideoPlayer';

// 预览 resizeMode 临时控件的取值(测完去掉控件、固定 cover);只用这 4 种。
export type SlideResizeMode = 'cover' | 'contain' | 'stretch' | 'center';

// resizeMode 由预览页临时控件传入,用于真机对比 cover/contain/stretch/center —— 选定后
// 会去掉控件、固定一种。缺省 cover = 与取景一致(满宽铺满、按比例裁上下,取景本就是 cover)。
export function SlideItem({
  file,
  resizeMode = 'cover',
}: {
  file: CustomPhotoFile;
  resizeMode?: SlideResizeMode;
}) {
  return (
    <View style={styles.root}>
      {file.mime === 'video/mp4' ? (
        <VideoPlayer uri={file.uri} />
      ) : (
        <Image
          source={{ uri: file.uri }}
          style={StyleSheet.absoluteFill}
          resizeMode={resizeMode}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // 相机 slide 固定黑底:让图/视频在纯黑上凸显的 UX 惯例,不走 c.background token.
  root: { flex: 1, backgroundColor: '#000' },
});
