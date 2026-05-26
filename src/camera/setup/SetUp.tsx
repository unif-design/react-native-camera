import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
      <TouchableOpacity onPress={nextFlash} testID="flash-btn">
        <Text style={styles.text}>{flashLabel[flash]}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() =>
          onChangeAspectRatio(aspectRatio === '4:3' ? '16:9' : '4:3')
        }
        testID="aspect-btn"
      >
        <Text style={styles.text}>{aspectRatio}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onToggleLens} testID="lens-btn">
        <Text style={styles.text}>{lensLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  text: {
    color: 'white',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 14,
  },
});
