import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@unif/react-native-design';
import { CameraDialogProvider } from './ui/CameraDialogHost';
import { VIEWFINDER } from './colors/viewfinder';

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
        {/* 相机 Modal 强制深色:取景永远暗底,内部 useColors() 恒返回 dark token
            (含 CameraDialogHost 弹窗),不跟随宿主 / 系统主题。 */}
        <ThemeProvider forceScheme="dark">
          {/* 本地弹窗系统:相机 Modal 内部自带 confirm/toast(absolute overlay),
              不走 design 全局 host —— 后者挂在 App 根,会被相机 Modal 盖住。 */}
          <CameraDialogProvider>
            <View style={styles.root}>{children}</View>
          </CameraDialogProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // 相机 Modal 根视图固定黑底:相机 UX 惯例,与 Container / 预览系列一致.
  root: { flex: 1, backgroundColor: VIEWFINDER.black },
});
