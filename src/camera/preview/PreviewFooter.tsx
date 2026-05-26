import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  onRetake: () => void;
  onConfirm: () => void;
};

export function PreviewFooter({ onRetake, onConfirm }: Props) {
  return (
    <View style={styles.root}>
      <TouchableOpacity onPress={onRetake} testID="retake-btn">
        <Text style={styles.text}>重拍</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onConfirm} testID="confirm-btn">
        <Text style={styles.text}>使用照片</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  text: { color: 'white', fontSize: 16 },
});
