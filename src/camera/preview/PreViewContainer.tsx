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
  root: { flex: 1, backgroundColor: 'black' },
});
