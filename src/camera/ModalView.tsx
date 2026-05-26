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
  // 相机 Modal 根视图固定黑底:相机 UX 惯例,与 Container / 预览系列一致.
  root: { flex: 1, backgroundColor: '#000' },
});
