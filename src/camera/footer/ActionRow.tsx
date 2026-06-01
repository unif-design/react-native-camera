import { StyleSheet, View } from 'react-native';
import { Button, r } from '@unif/react-native-design';
import { Shutter } from './Shutter';
import { ThumbnailStack } from './ThumbnailStack';
import { FlipButton } from './FlipButton';

type Props = {
  mode: 'single' | 'continuous' | 'video';
  recording: boolean;
  latestUri?: string;
  count: number;
  onShutter: () => void;
  onBack: () => void;
  onSave: () => void;
  onFlip: () => void;
  onOpenPreview: () => void;
};

export function ActionRow({
  mode,
  recording,
  latestUri,
  count,
  onShutter,
  onBack,
  onSave,
  onFlip,
  onOpenPreview,
}: Props) {
  return (
    <View style={styles.row}>
      {!recording ? (
        <ThumbnailStack
          latestUri={latestUri}
          count={count}
          onPress={onOpenPreview}
        />
      ) : (
        <View style={styles.slot} />
      )}
      {!recording ? (
        <Button
          variant="ghost"
          label="返回"
          onPress={onBack}
          testID="back-btn"
        />
      ) : (
        <View style={styles.slot} />
      )}
      <Shutter mode={mode} recording={recording} onPress={onShutter} />
      {!recording ? (
        <Button
          variant="primary"
          label="保存"
          onPress={onSave}
          testID="save-btn"
        />
      ) : (
        <View style={styles.slot} />
      )}
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
    paddingHorizontal: r(20),
  },
  slot: { width: r(44) },
});
