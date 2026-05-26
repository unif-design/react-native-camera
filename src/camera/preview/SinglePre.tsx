import { Image, StyleSheet, View } from 'react-native';
import { Empty } from '@unif/react-native-design';
import type { CustomPhotoFile } from '../../utils';

type Props = { file: CustomPhotoFile };

export function SinglePre({ file }: Props) {
  return (
    <View style={styles.root} testID="single-pre">
      {file.mime === 'video/mp4' ? (
        <Empty
          title={`视频 · ${file.duration?.toFixed(1) ?? '0.0'}s`}
          desc={file.path}
        />
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
  // 相机预览容器固定黑底:相机 UX 惯例(任何主题下都需要让照片 / 视频在纯黑上凸显),
  // 不走 c.background token.
  root: { flex: 1, backgroundColor: '#000' },
});
