import { UndoOutlined, WarningOutlined } from '@unif/react-native-icons';
import { useEffect } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { act, fireEvent, userEvent } from '@testing-library/react-native';
import { GlassLayer, darkColors } from '@unif/react-native-design';
import * as Reanimated from 'react-native-reanimated';
import { renderDark } from '../__helpers__/renderDark';
import { FlipButton } from '../../camera/footer/FlipButton';
import { PreviewActionButton } from '../../camera/preview/PreviewActionButton';
import {
  CameraDialogProvider,
  useCameraDialog,
} from '../../camera/ui/CameraDialogHost';

// UIVisualEffectView 的自身和祖先不能随前景一起淡出，否则原生材质会消失。
function expectOpaqueAncestors(layer: ReactTestInstance) {
  for (let node: ReactTestInstance | null = layer; node; node = node.parent) {
    // Jest 的 Animated 替身不兑现该组件内建的原生 alpha 动画。
    expect(node.type).not.toBe(TouchableOpacity);
    if (typeof node.type !== 'string') continue;
    const opacity = StyleSheet.flatten(node.props.style)?.opacity;
    const value =
      typeof opacity === 'object' && opacity !== null
        ? opacity.__getValue()
        : opacity;
    expect(value ?? 1).toBe(1);
  }
}

function pressKeepingGlassOpaque(layer: () => ReactTestInstance) {
  return userEvent.setup({
    advanceTimers: (delay) => {
      act(() => jest.advanceTimersByTime(delay));
      expectOpaqueAncestors(layer());
    },
  });
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});

test('翻转按钮按压只改变前景，玻璃祖先保持不透明且只交付一次', async () => {
  const onFlip = jest.fn();
  const page = renderDark(<FlipButton onFlip={onFlip} />);
  const user = pressKeepingGlassOpaque(() =>
    page.getByTestId('flip-glass', { includeHiddenElements: true })
  );
  await user.press(page.getByRole('button', { name: '切换前后摄像头' }));
  expect(onFlip).toHaveBeenCalledTimes(1);
});

test('预览普通操作按压和禁用不使玻璃祖先透明，禁用仍阻止交付', async () => {
  const onPress = jest.fn();
  const content = (disabled = false) => (
    <PreviewActionButton
      icon={UndoOutlined}
      label="返回"
      tone="neutral"
      onPress={onPress}
      testID="preview-action"
      disabled={disabled}
    />
  );
  const page = renderDark(content());
  const user = pressKeepingGlassOpaque(() => page.UNSAFE_getByType(GlassLayer));
  await user.press(page.getByRole('button', { name: '返回' }));
  expect(onPress).toHaveBeenCalledTimes(1);
  page.rerender(content(true));
  expectOpaqueAncestors(page.UNSAFE_getByType(GlassLayer));
  expect(page.getByText('返回')).toHaveStyle({ opacity: 0.45 });
  fireEvent.press(page.getByRole('button', { name: '返回', disabled: true }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

function ToastTrigger() {
  const { toast } = useCameraDialog();
  useEffect(() => toast('已切换模式'), [toast]);
  return null;
}

function ErrorTrigger() {
  const { showError } = useCameraDialog();
  useEffect(() => showError('拍摄失败'), [showError]);
  return null;
}

test('错误提示在淡入中保持玻璃不透明，并保留告警颜色与原自动移除', () => {
  const timing = jest.spyOn(Reanimated, 'withTiming').mockReturnValue(0.5);
  try {
    const page = renderDark(
      <CameraDialogProvider>
        <ErrorTrigger />
      </CameraDialogProvider>
    );
    expectOpaqueAncestors(page.UNSAFE_getByType(GlassLayer));
    const warning = page.UNSAFE_getByType(WarningOutlined);
    expect(warning?.props.color).toBe(darkColors.error);
    expect(page.getByRole('alert')).toHaveTextContent('相机异常:拍摄失败');
    act(() => jest.advanceTimersByTime(4000));
    expect(page.queryByTestId('camera-error-bar')).toBeNull();
  } finally {
    timing.mockRestore();
  }
});

test('相机局部toast的玻璃祖先保持不透明，仍按原时长移除', () => {
  const page = renderDark(
    <CameraDialogProvider>
      <ToastTrigger />
    </CameraDialogProvider>
  );
  expectOpaqueAncestors(page.UNSAFE_getByType(GlassLayer));
  act(() => jest.advanceTimersByTime(1999));
  expect(page.getByText('已切换模式')).toBeTruthy();
  expectOpaqueAncestors(page.UNSAFE_getByType(GlassLayer));
  act(() => jest.advanceTimersByTime(1));
  expect(page.queryByTestId('camera-toast')).toBeNull();
});
