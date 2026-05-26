import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CustomPhotoFile } from '../../utils';
import { Carousel } from '../../components/Carousel';
import { PreviewThumbnail } from '../../components/PreviewThumbnail';

type Props = { files: CustomPhotoFile[] };

export function PreView({ files }: Props) {
  const [index, setIndex] = useState(0);
  return (
    <View style={styles.root} testID="multi-pre">
      <Carousel data={files} onIndexChange={setIndex} />
      <View style={styles.thumbWrap}>
        <PreviewThumbnail files={files} currentIndex={index} onTap={setIndex} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'black' },
  thumbWrap: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
