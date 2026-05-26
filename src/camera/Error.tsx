import { StyleSheet, Text, View } from 'react-native';

export function ErrorView({ message }: { message: string }) {
  return (
    <View style={styles.root} testID="error-view">
      <Text style={styles.text}>{message}</Text>
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
  text: { color: 'white', fontSize: 14 },
});
