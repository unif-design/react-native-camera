import { Modal, StatusBar, View } from 'react-native';
import { ThemeProvider, useTheme } from '@unif/react-native-design';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CameraDialogProvider } from './ui/CameraDialogHost';
import { styles } from './modal/styles';
import type { ModalViewProps } from './types';

export function ModalView({
  visible,
  sessionId,
  onClose,
  children,
}: ModalViewProps) {
  const { fontScale } = useTheme();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
      testID="camera-modal"
    >
      <StatusBar barStyle="light-content" />
      {/* Modal 展示在独立 native root/window，消费者 App 根的原生手势 root 无法覆盖
          这里的子树；因此相机内部自带 flex:1 root，确保 pinch / tap 始终可识别。 */}
      <GestureHandlerRootView
        testID="camera-gesture-root"
        accessibilityViewIsModal
        style={styles.gestureRoot}
      >
        <SafeAreaProvider>
          {/* 取景窗口使用暗色表面；字号继承外层唯一配置，随宿主变化。 */}
          <ThemeProvider forceScheme="dark" fontScale={fontScale}>
            <CameraDialogProvider key={sessionId}>
              <View style={styles.root}>{children}</View>
            </CameraDialogProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Modal>
  );
}
