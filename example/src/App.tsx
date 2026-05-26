import { Text, View, StyleSheet } from 'react-native';
import { VERSION } from '@unif/react-native-camera';

export default function App() {
  return (
    <View style={styles.container}>
      <Text>v{VERSION}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
