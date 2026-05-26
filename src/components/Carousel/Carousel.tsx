import { StyleSheet, useWindowDimensions, View } from 'react-native';
import RNCarousel from 'react-native-reanimated-carousel';
import type { CustomPhotoFile } from '../../utils';
import { SlideItem } from './SlideItem';

type Props = {
  data: CustomPhotoFile[];
  onIndexChange?: (i: number) => void;
};

export function Carousel({ data, onIndexChange }: Props) {
  const { width, height } = useWindowDimensions();
  return (
    <View style={styles.root}>
      <RNCarousel
        data={data}
        width={width}
        height={height}
        loop={false}
        onSnapToItem={onIndexChange}
        renderItem={({ item }) => <SlideItem file={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
