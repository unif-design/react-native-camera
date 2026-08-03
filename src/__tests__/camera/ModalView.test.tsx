import { StyleSheet, Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { ModalView } from '../../camera/ModalView';

// ModalView 是相机弹窗宿主:Modal + SafeAreaProvider + forceScheme="dark" ThemeProvider +
// CameraDialogProvider 包裹 children。自带全套 provider,故用裸 render(不再外包)验证:
//   - visible 时挂载不崩、children 渲染、testID 'camera-modal' 在
//   - visible=false 时不崩(holder 未挂可见 → 相机不弹的常态)

it('visible 时渲染 Modal 宿主与 children(自带 dark/safe-area/dialog provider)', () => {
  const { getByTestId, getByText } = render(
    <ModalView visible onClose={() => {}}>
      <Text testID="modal-child">hi</Text>
    </ModalView>
  );
  expect(getByTestId('camera-modal')).toBeTruthy();
  expect(getByTestId('modal-child')).toBeTruthy();
  expect(getByText('hi')).toBeTruthy();
});

it('visible=false 时渲染不崩(相机未弹常态)', () => {
  expect(() =>
    render(
      <ModalView visible={false} onClose={() => {}}>
        <Text>hidden</Text>
      </ModalView>
    )
  ).not.toThrow();
});

it('Modal 自带 flex:1 GestureHandlerRootView，手势不依赖消费者根节点', () => {
  const { getByTestId } = render(
    <ModalView visible onClose={() => {}}>
      <Text>gesture child</Text>
    </ModalView>
  );

  expect(
    StyleSheet.flatten(getByTestId('camera-gesture-root').props.style)
  ).toEqual(expect.objectContaining({ flex: 1 }));
});

it('Modal 仅开放正向竖屏与左右横屏', () => {
  const { getByTestId } = render(
    <ModalView visible onClose={() => {}}>
      <Text>orientation child</Text>
    </ModalView>
  );

  expect(getByTestId('camera-modal').props.supportedOrientations).toEqual([
    'portrait',
    'landscape-left',
    'landscape-right',
  ]);
});
