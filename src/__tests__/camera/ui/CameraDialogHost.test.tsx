import { useEffect } from 'react';
import { Text, Pressable } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import {
  CameraDialogProvider,
  useCameraDialog,
} from '../../../camera/ui/CameraDialogHost';

// 触发 confirm 的测试宿主:挂载即调一次 confirm,把 resolve 结果回吐到 onResult。
function ConfirmTrigger({
  onResult,
  destructive,
}: {
  onResult: (b: boolean) => void;
  destructive?: boolean;
}) {
  const { confirm } = useCameraDialog();
  return (
    <Pressable
      testID="trigger-confirm"
      onPress={() => {
        confirm({
          title: '确认删除?',
          message: '图片删除后无法恢复',
          destructive,
        }).then(onResult);
      }}
    >
      <Text>open</Text>
    </Pressable>
  );
}

// 触发 toast 的测试宿主:挂载即弹一次 toast。
function ToastTrigger({ msg }: { msg: string }) {
  const { toast } = useCameraDialog();
  useEffect(() => {
    toast(msg);
  }, [toast, msg]);
  return null;
}

// 触发 showError 的测试宿主:点按钮弹错误条(可点多次验证去抖)。
function ErrorTrigger({ msg }: { msg: string }) {
  const { showError } = useCameraDialog();
  return (
    <Pressable testID="trigger-error" onPress={() => showError(msg)}>
      <Text>err</Text>
    </Pressable>
  );
}

function wrap(children: React.ReactNode) {
  return (
    <ThemeProvider>
      <CameraDialogProvider>{children}</CameraDialogProvider>
    </ThemeProvider>
  );
}

describe('CameraDialogHost', () => {
  it('useCameraDialog 在 Provider 外抛错', () => {
    // 屏蔽 React 对抛错渲染打印的红色 console.error 噪音
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    function Bare() {
      useCameraDialog();
      return null;
    }
    expect(() => render(<Bare />)).toThrow(
      'useCameraDialog must be used within CameraDialogProvider'
    );
    spy.mockRestore();
  });

  it('confirm 渲染标题/消息 + 确认/取消按钮', () => {
    const { getByTestId, getByText, queryByTestId } = render(
      wrap(<ConfirmTrigger onResult={() => {}} />)
    );
    // 触发前不渲染弹窗
    expect(queryByTestId('camera-confirm')).toBeNull();
    fireEvent.press(getByTestId('trigger-confirm'));
    expect(getByTestId('camera-confirm')).toBeTruthy();
    expect(getByTestId('camera-confirm-ok')).toBeTruthy();
    expect(getByTestId('camera-confirm-cancel')).toBeTruthy();
    expect(getByText('确认删除?')).toBeTruthy();
    expect(getByText('图片删除后无法恢复')).toBeTruthy();
  });

  it('点确认 resolve(true) 并关闭弹窗', async () => {
    const onResult = jest.fn();
    const { getByTestId, queryByTestId } = render(
      wrap(<ConfirmTrigger onResult={onResult} />)
    );
    fireEvent.press(getByTestId('trigger-confirm'));
    fireEvent.press(getByTestId('camera-confirm-ok'));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
    expect(queryByTestId('camera-confirm')).toBeNull();
  });

  it('点取消 resolve(false) 并关闭弹窗', async () => {
    const onResult = jest.fn();
    const { getByTestId, queryByTestId } = render(
      wrap(<ConfirmTrigger onResult={onResult} />)
    );
    fireEvent.press(getByTestId('trigger-confirm'));
    fireEvent.press(getByTestId('camera-confirm-cancel'));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
    expect(queryByTestId('camera-confirm')).toBeNull();
  });

  it('点背景遮罩 resolve(false) 并关闭弹窗', async () => {
    const onResult = jest.fn();
    const { getByTestId, queryByTestId } = render(
      wrap(<ConfirmTrigger onResult={onResult} />)
    );
    fireEvent.press(getByTestId('trigger-confirm'));
    fireEvent.press(getByTestId('camera-confirm-backdrop'));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
    expect(queryByTestId('camera-confirm')).toBeNull();
  });

  it('toast 渲染文案', () => {
    const { getByTestId, getByText } = render(
      wrap(<ToastTrigger msg="已保存" />)
    );
    expect(getByTestId('camera-toast')).toBeTruthy();
    expect(getByText('已保存')).toBeTruthy();
  });

  describe('showError 顶部错误条', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
      act(() => jest.runOnlyPendingTimers());
      jest.useRealTimers();
    });

    it('触发后显示错误条 + "相机异常:" 前缀文案', () => {
      const { getByTestId, getByText, queryByTestId } = render(
        wrap(<ErrorTrigger msg="session 中断" />)
      );
      expect(queryByTestId('camera-error-bar')).toBeNull();
      fireEvent.press(getByTestId('trigger-error'));
      expect(getByTestId('camera-error-bar')).toBeTruthy();
      expect(getByText('相机异常:session 中断')).toBeTruthy();
    });

    it('4s 后自动消失', () => {
      const { getByTestId, queryByTestId } = render(
        wrap(<ErrorTrigger msg="掉线了" />)
      );
      fireEvent.press(getByTestId('trigger-error'));
      expect(getByTestId('camera-error-bar')).toBeTruthy();
      act(() => jest.advanceTimersByTime(4000));
      expect(queryByTestId('camera-error-bar')).toBeNull();
    });

    it('手动 ✕ 立即关闭', () => {
      const { getByTestId, queryByTestId } = render(
        wrap(<ErrorTrigger msg="点叉关掉" />)
      );
      fireEvent.press(getByTestId('trigger-error'));
      expect(getByTestId('camera-error-bar')).toBeTruthy();
      fireEvent.press(getByTestId('camera-error-close'));
      expect(queryByTestId('camera-error-bar')).toBeNull();
    });

    it('去抖:同 message 短时间内连发,关掉后再发仍被抑制(不重弹)', () => {
      const { getByTestId, queryByTestId } = render(
        wrap(<ErrorTrigger msg="重复错误" />)
      );
      fireEvent.press(getByTestId('trigger-error'));
      expect(getByTestId('camera-error-bar')).toBeTruthy();
      // 手动关掉后立刻再发同 message:距上次 < 去抖窗口 → 抑制,不重弹。
      fireEvent.press(getByTestId('camera-error-close'));
      fireEvent.press(getByTestId('trigger-error'));
      expect(queryByTestId('camera-error-bar')).toBeNull();
    });

    it('去抖:超过 5s 后同 message 可再次显示', () => {
      const { getByTestId, queryByTestId } = render(
        wrap(<ErrorTrigger msg="过窗口" />)
      );
      fireEvent.press(getByTestId('trigger-error'));
      // 等过自动消失(4s)+ 去抖窗口(5s):>5s 后同 message 不再被抑制。
      act(() => jest.advanceTimersByTime(6000));
      expect(queryByTestId('camera-error-bar')).toBeNull();
      fireEvent.press(getByTestId('trigger-error'));
      expect(getByTestId('camera-error-bar')).toBeTruthy();
    });

    it('不同 message 即使紧接着也照常显示', () => {
      function TwoErrors() {
        const { showError } = useCameraDialog();
        return (
          <>
            <Pressable testID="err-a" onPress={() => showError('A')}>
              <Text>a</Text>
            </Pressable>
            <Pressable testID="err-b" onPress={() => showError('B')}>
              <Text>b</Text>
            </Pressable>
          </>
        );
      }
      const { getByTestId, getByText } = render(wrap(<TwoErrors />));
      fireEvent.press(getByTestId('err-a'));
      expect(getByText('相机异常:A')).toBeTruthy();
      fireEvent.press(getByTestId('err-b'));
      expect(getByText('相机异常:B')).toBeTruthy();
    });
  });
});
