import { Alert } from 'react-native';

export function useConfirm() {
  return (title: string, message: string) =>
    new Promise<boolean>((resolve) => {
      Alert.alert(title, message, [
        { text: '取消', onPress: () => resolve(false), style: 'cancel' },
        { text: '确认', onPress: () => resolve(true) },
      ]);
    });
}
