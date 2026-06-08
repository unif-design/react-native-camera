import { StyleSheet, TouchableOpacity } from 'react-native';
import {
  Icon,
  r,
  useColors,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';

export function FlipButton({ onFlip }: { onFlip: () => void }) {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity testID="flip-btn" onPress={onFlip} style={styles.btn}>
      <Icon name="lens-flip" size={r(20)} color={c.foreground} />
    </TouchableOpacity>
  );
}

const makeStyles = (c: ColorTokens) =>
  StyleSheet.create({
    btn: {
      width: r(44),
      height: r(44),
      borderRadius: r(22),
      backgroundColor: c.glassPillBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
