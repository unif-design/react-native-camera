import { StyleSheet, View } from 'react-native';
import { Button, r } from '@unif/react-native-design';

type Props = {
  onRetake: () => void;
  onConfirm: () => void;
};

export function PreviewFooter({ onRetake, onConfirm }: Props) {
  return (
    <View style={styles.root}>
      <Button
        variant="ghost"
        label="重拍"
        onPress={onRetake}
        testID="retake-btn"
      />
      <Button
        variant="primary"
        label="使用照片"
        onPress={onConfirm}
        testID="confirm-btn"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    bottom: r(40),
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
});
