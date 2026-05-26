import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = { onCancel: () => void; onOpenSettings?: () => void };

export function NoPermission({ onCancel, onOpenSettings }: Props) {
  return (
    <View style={styles.root} testID="no-permission">
      <Text style={styles.title}>相机权限被拒</Text>
      <Text style={styles.message}>请前往系统设置开启权限</Text>
      <View style={styles.row}>
        <TouchableOpacity onPress={onCancel} style={styles.btn}>
          <Text style={styles.btnText}>取消</Text>
        </TouchableOpacity>
        {onOpenSettings && (
          <TouchableOpacity onPress={onOpenSettings} style={styles.btn}>
            <Text style={styles.btnText}>去设置</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: { color: 'white', fontSize: 18, marginBottom: 8 },
  message: { color: '#bbb', fontSize: 14, marginBottom: 24 },
  row: { flexDirection: 'row', gap: 16 },
  btn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'white',
    borderRadius: 6,
  },
  btnText: { color: 'white' },
});
