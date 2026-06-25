import { StyleSheet, View } from 'react-native';
import { r } from '@unif/react-native-design';
import { Shutter } from './Shutter';
import { ThumbnailStack } from './ThumbnailStack';
import { FlipButton } from './FlipButton';

type Props = {
  mode: 'single' | 'continuous' | 'video';
  recording: boolean;
  /** 一次快门处理中(capture/烧水印):禁用快门防连点(连点并发堆积大图会 OOM 闪退)。 */
  shutterDisabled?: boolean;
  latestUri?: string;
  count: number;
  onShutter: () => void;
  onFlip: () => void;
  onOpenPreview: () => void;
};

export function ActionRow({
  mode,
  recording,
  shutterDisabled,
  latestUri,
  count,
  onShutter,
  onFlip,
  onOpenPreview,
}: Props) {
  return (
    <View style={styles.row}>
      {!recording && latestUri ? (
        <ThumbnailStack
          latestUri={latestUri}
          count={count}
          onPress={onOpenPreview}
        />
      ) : (
        <View style={styles.slot} />
      )}
      <Shutter
        mode={mode}
        recording={recording}
        disabled={shutterDisabled}
        onPress={onShutter}
      />
      {!recording ? (
        <FlipButton onFlip={onFlip} />
      ) : (
        <View style={styles.slot} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: r(28),
  },
  slot: { width: r(44) },
});
