import type { ReactElement } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import { Shutter } from './Shutter';

// 相机 Modal 强制 dark,Shutter 用 useThemedStyles —— 包 dark Provider 对齐运行时。
const wrap = (ui: ReactElement) => (
  <ThemeProvider forceScheme="dark">{ui}</ThemeProvider>
);

it('fires onPress and renders for each mode', () => {
  const onPress = jest.fn();
  const { getByTestId, rerender } = render(
    wrap(<Shutter mode="single" recording={false} onPress={onPress} />)
  );
  fireEvent.press(getByTestId('shutter-btn'));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(() =>
    rerender(wrap(<Shutter mode="video" recording={false} onPress={onPress} />))
  ).not.toThrow();
  expect(() =>
    rerender(wrap(<Shutter mode="video" recording={true} onPress={onPress} />))
  ).not.toThrow();
});

it('disabled blocks press', () => {
  const onPress = jest.fn();
  const { getByTestId } = render(
    wrap(<Shutter mode="single" recording={false} disabled onPress={onPress} />)
  );
  fireEvent.press(getByTestId('shutter-btn'));
  expect(onPress).not.toHaveBeenCalled();
});
