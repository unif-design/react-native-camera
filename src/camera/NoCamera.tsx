import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = { onCancel: () => void };

export function NoCamera({ onCancel }: Props) {
  return (
    <View style={styles.root} testID="no-camera">
      <Text style={styles.title}>未检测到可用相机</Text>
      <TouchableOpacity onPress={onCancel} style={styles.btn}>
        <Text style={styles.btnText}>关闭</Text>
      </TouchableOpacity>
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
  title: { color: 'white', fontSize: 16, marginBottom: 24 },
  btn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'white',
    borderRadius: 6,
  },
  btnText: { color: 'white' },
});
