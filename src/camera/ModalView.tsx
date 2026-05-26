import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@unif/react-native-design';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export function ModalView({ visible, onClose, children }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
      testID="camera-modal"
    >
      <SafeAreaProvider>
        <ThemeProvider>
          <View style={styles.root}>{children}</View>
        </ThemeProvider>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'black' },
});
