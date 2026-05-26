import { StyleSheet, View } from 'react-native';
import type { CustomPhotoFile } from '../../utils';
import { SinglePre } from './SinglePre';
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
      {
        files.length === 1 && first != null ? (
          <SinglePre file={first} />
        ) : null /* 多图轮播在 Task 12 实现 */
      }
      <PreviewFooter onRetake={onRetake} onConfirm={onConfirm} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'black' },
});
