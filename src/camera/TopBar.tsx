import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Icon, r } from '@unif/react-native-design';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DARK } from './colors/dark';

// 取景顶部栏:左上角取消(X)。flex 布局,顶部留安全区。
export function TopBar({ onCancel }: { onCancel: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + r(8) }]}>
      <TouchableOpacity
        testID="cancel-btn"
        style={styles.btn}
        onPress={onCancel}
      >
        <Icon name="close" size={r(22)} color={DARK.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: r(12),
    paddingBottom: r(8),
  },
  btn: {
    width: r(40),
    height: r(40),
    borderRadius: r(20),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DARK.black42,
  },
});
