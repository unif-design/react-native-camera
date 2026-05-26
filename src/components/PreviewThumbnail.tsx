import { StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  Thumbnail,
  r,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';
import type { CustomPhotoFile } from '../utils';

type Props = {
  files: CustomPhotoFile[];
  currentIndex: number;
  onTap: (i: number) => void;
};

export function PreviewThumbnail({ files, currentIndex, onTap }: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      {files.map((f, i) => (
        <TouchableOpacity
          key={`${f.path}-${i}`}
          onPress={() => onTap(i)}
          style={[
            styles.thumbWrap,
            i === currentIndex && styles.thumbWrapActive,
          ]}
        >
          <Thumbnail uri={f.uri} size="sm" />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const makeStyles = (c: ColorTokens) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: r(6), padding: r(8) },
    thumbWrap: {
      borderRadius: r(4),
      borderWidth: 2,
      borderColor: 'transparent',
    },
    thumbWrapActive: { borderColor: c.primary },
  });
