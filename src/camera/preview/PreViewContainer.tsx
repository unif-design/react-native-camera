import { StyleSheet, View } from 'react-native';
import type { CustomPhotoFile } from '../../utils';
import { SinglePre } from './SinglePre';
import { PreView } from './PreView';
import { PreviewFooter } from './PreviewFooter';

type Props = {
  files: CustomPhotoFile[];
  onRetake: () => void;
  onConfirm: () => void;
};

export function PreViewContainer({ files, onRetake, onConfirm }: Props) {
  const first = files[0];
  return (
    <View style={styles.root}>
      {files.length === 1 && first != null ? (
        <SinglePre file={first} />
      ) : files.length > 1 ? (
        <PreView files={files} />
      ) : null}
      <PreviewFooter onRetake={onRetake} onConfirm={onConfirm} />
    </View>
  );
}

const styles = StyleSheet.create({
  // 预览容器固定黑底:相机 UX 惯例,与 SinglePre / PreView / SlideItem 一致.
  root: { flex: 1, backgroundColor: '#000' },
});
