import { StyleSheet, View } from 'react-native';
import { Chip, r } from '@unif/react-native-design';

export type FlashMode = 'off' | 'on' | 'auto';
export type AspectRatio = '4:3' | '16:9';

type Props = {
  flash: FlashMode;
  aspectRatio: AspectRatio;
  onChangeFlash: (m: FlashMode) => void;
  onChangeAspectRatio: (r: AspectRatio) => void;
  onToggleLens: () => void;
  lensLabel: string;
};

const flashLabel: Record<FlashMode, string> = {
  off: '闪关',
  on: '闪开',
  auto: '自动',
};
const flashOrder: FlashMode[] = ['off', 'auto', 'on'];

export function SetUp({
  flash,
  aspectRatio,
  onChangeFlash,
  onChangeAspectRatio,
  onToggleLens,
  lensLabel,
}: Props) {
  const nextFlash = () => {
    const i = flashOrder.indexOf(flash);
    const next = flashOrder[(i + 1) % flashOrder.length] as FlashMode;
    onChangeFlash(next);
  };
  return (
    <View style={styles.root}>
      <Chip
        label={flashLabel[flash]}
        onPress={nextFlash}
        selected={flash !== 'off'}
        testID="flash-btn"
      />
      <Chip
        label={aspectRatio}
        onPress={() =>
          onChangeAspectRatio(aspectRatio === '4:3' ? '16:9' : '4:3')
        }
        testID="aspect-btn"
      />
      <Chip label={lensLabel} onPress={onToggleLens} testID="lens-btn" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: r(60),
    left: r(16),
    right: r(16),
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
