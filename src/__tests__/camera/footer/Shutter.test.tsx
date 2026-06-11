import { fireEvent } from '@testing-library/react-native';
import { renderDark } from '../../__helpers__/renderDark';
import { Shutter } from '../../../camera/footer/Shutter';

// 相机 Modal 强制 dark,Shutter 用 useThemedStyles —— renderDark 用 RTL wrapper 包 dark Provider,
// rerender 自动保持同一 wrapper,故 rerender 直接传组件即可(无需手动重包)。

it('fires onPress and renders for each mode', () => {
  const onPress = jest.fn();
  const { getByTestId, rerender } = renderDark(
    <Shutter mode="single" recording={false} onPress={onPress} />
  );
  fireEvent.press(getByTestId('shutter-btn'));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(() =>
    rerender(<Shutter mode="video" recording={false} onPress={onPress} />)
  ).not.toThrow();
  expect(() =>
    rerender(<Shutter mode="video" recording={true} onPress={onPress} />)
  ).not.toThrow();
});

it('disabled blocks press', () => {
  const onPress = jest.fn();
  const { getByTestId } = renderDark(
    <Shutter mode="single" recording={false} disabled onPress={onPress} />
  );
  fireEvent.press(getByTestId('shutter-btn'));
  expect(onPress).not.toHaveBeenCalled();
});
