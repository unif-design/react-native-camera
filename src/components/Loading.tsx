import { ActivityIndicator, StyleSheet, View } from 'react-native';

export function Loading() {
  return (
    <View style={styles.root} testID="loading">
      <ActivityIndicator color="white" size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { justifyContent: 'center', alignItems: 'center' },
});
