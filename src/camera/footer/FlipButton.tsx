import { StyleSheet, TouchableOpacity } from 'react-native';
import { Icon, r } from '@unif/react-native-design';
import { DARK } from '../colors/dark';

export function FlipButton({ onFlip }: { onFlip: () => void }) {
  return (
    <TouchableOpacity testID="flip-btn" onPress={onFlip} style={styles.btn}>
      <Icon name="lens-flip" size={r(20)} color={DARK.white} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: r(44),
    height: r(44),
    borderRadius: r(22),
    backgroundColor: DARK.white12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
