import { useEffect } from 'react';
import { Text, Pressable } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
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
});
