import { NativeModules, StatusBar, StyleSheet, Text } from 'react-native';
import {
  act,
  cleanupAsync,
  fireEvent,
  render,
} from '@testing-library/react-native';
import { ThemeProvider, useTheme } from '@unif/react-native-design';
import { ModalView } from '../../camera/ModalView';

// 保留真实 iOS Modal 的 isRendered / onDismiss 生命周期，仅替换原生视图边界。
jest.unmock('react-native/Libraries/Modal/Modal');
jest.mock(
  'react-native/Libraries/Modal/RCTModalHostViewNativeComponent',
  () => 'RCTModalHostView'
);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(async () => {
  await cleanupAsync();
  flushStatusBar();
  jest.useRealTimers();
});

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

function HostStatusBar() {
  const { scheme } = useTheme();
  return (
    <StatusBar
      barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
    />
  );
}

function StatusBarHost({
  scheme,
  visible,
  mounted = true,
}: {
  scheme: 'light' | 'dark';
  visible: boolean;
  mounted?: boolean;
}) {
  return (
    <ThemeProvider forceScheme={scheme}>
      <HostStatusBar />
      {mounted && (
        <ModalView visible={visible} onClose={() => {}}>
          <Text>camera</Text>
        </ModalView>
      )}
    </ThemeProvider>
  );
}

function flushStatusBar() {
  act(() => jest.runOnlyPendingTimers());
}

describe('Modal 状态栏归属', () => {
  it('visible=false 时保留浅色宿主的深色状态栏', () => {
    render(<StatusBarHost scheme="light" visible={false} />);
    flushStatusBar();

    expect(NativeModules.StatusBarManager.setStyle).toHaveBeenLastCalledWith(
      'dark-content',
      false
    );
  });

  it.each(['close', 'unmount'] as const)(
    '%s：打开后持续浅色前景，退出时恢复宿主当前主题',
    (exit) => {
      const { getByTestId, queryByTestId, rerender } = render(
        <StatusBarHost scheme="light" visible={false} />
      );
      flushStatusBar();

      rerender(<StatusBarHost scheme="light" visible />);
      flushStatusBar();
      expect(NativeModules.StatusBarManager.setStyle).toHaveBeenLastCalledWith(
        'light-content',
        false
      );

      rerender(<StatusBarHost scheme="dark" visible />);
      flushStatusBar();
      rerender(<StatusBarHost scheme="light" visible />);
      flushStatusBar();
      expect(NativeModules.StatusBarManager.setStyle).toHaveBeenLastCalledWith(
        'light-content',
        false
      );

      rerender(
        <StatusBarHost
          scheme="light"
          visible={false}
          mounted={exit !== 'unmount'}
        />
      );
      flushStatusBar();
      if (exit === 'close') {
        expect(getByTestId('camera-modal')).toHaveProp('visible', false);
        expect(
          NativeModules.StatusBarManager.setStyle
        ).toHaveBeenLastCalledWith('light-content', false);
        fireEvent(getByTestId('camera-modal'), 'dismiss');
        flushStatusBar();
      }
      expect(queryByTestId('camera-modal')).toBeNull();
      expect(NativeModules.StatusBarManager.setStyle).toHaveBeenLastCalledWith(
        'dark-content',
        false
      );
    }
  );
});
