import { StyleSheet, View } from 'react-native';
import { Spinner, r } from '@unif/react-native-design';

export function Loading() {
  return (
    <View style={styles.root} testID="loading">
      <Spinner size={r(32)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { justifyContent: 'center', alignItems: 'center' },
});
