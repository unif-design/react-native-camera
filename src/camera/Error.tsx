import { StyleSheet, View } from 'react-native';
import {
  Empty,
  r,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';

export function ErrorView({ message }: { message: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.root} testID="error-view">
      <Empty icon="error-alert" title={message} />
    </View>
  );
}

const makeStyles = (c: ColorTokens) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: r(24),
      backgroundColor: c.background,
    },
  });
