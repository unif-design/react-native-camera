import { StyleSheet, View } from 'react-native';
import {
  Button,
  Empty,
  r,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';

type Props = { onCancel: () => void; onOpenSettings?: () => void };

export function NoPermission({ onCancel, onOpenSettings }: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.root} testID="no-permission">
      <Empty title="相机权限被拒" desc="请前往系统设置开启权限" />
      <View style={styles.row}>
        <Button
          variant="ghost"
          label="取消"
          onPress={onCancel}
          testID="cancel-btn"
        />
        {onOpenSettings && (
          <Button
            variant="primary"
            label="去设置"
            onPress={onOpenSettings}
            testID="open-settings-btn"
          />
        )}
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
    row: { flexDirection: 'row', gap: r(16), marginTop: r(16) },
  });
