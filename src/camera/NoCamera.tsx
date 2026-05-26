import { StyleSheet, View } from 'react-native';
import {
  Button,
  Empty,
  r,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';

type Props = { onCancel: () => void };

export function NoCamera({ onCancel }: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.root} testID="no-camera">
      <Empty title="未检测到可用相机" />
      <View style={styles.row}>
        <Button
          variant="primary"
          label="关闭"
          onPress={onCancel}
          testID="close-btn"
        />
      </View>
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
    row: { marginTop: r(16) },
  });
