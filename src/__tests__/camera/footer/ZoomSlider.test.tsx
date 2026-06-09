import type { ReactElement } from 'react';
import { render, fireEvent, within } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import { ZoomSlider } from '../../../camera/footer/ZoomSlider';

// 相机 Modal 强制 dark;ZoomSlider 内部档位药丸用 useThemedStyles —— 包 dark Provider 对齐运行时。
const r = (ui: ReactElement) =>
  render(<ThemeProvider forceScheme="dark">{ui}</ThemeProvider>);

const baseProps = {
  zoomShared: { value: 2 } as any, // vzf;jest 下 useSharedValue 桩返 {value}
  displayMul: 0.5,
  minDisplay: 0.5,
  maxDisplay: 10,
  deviceMinZoom: 1,
  deviceMaxZoom: 20,
  minZoom: 0.5,
  maxZoom: 10,
};

test('透传 display 倍数给档位药丸:点击 .5 档仍走 onSelect(标称 0.5)', () => {
  const onSelect = jest.fn();
  const { getByTestId } = r(
    <ZoomSlider {...baseProps} displayZoom={1} onSelect={onSelect} />
  );
  // 三档(0.5/1/2)都渲染(minDisplay=0.5、maxDisplay=10 容纳)。
  expect(getByTestId('zoom-chip-0.5')).toBeTruthy();
  expect(getByTestId('zoom-chip-1')).toBeTruthy();
  expect(getByTestId('zoom-chip-2')).toBeTruthy();
  fireEvent.press(getByTestId('zoom-chip-0.5'));
  expect(onSelect).toHaveBeenCalledWith(0.5);
});

test('当前档高亮显示实际 display 倍数(1.5x 落 1 档)', () => {
  const { getByTestId } = r(
    <ZoomSlider {...baseProps} displayZoom={1.5} onSelect={() => {}} />
  );
  expect(within(getByTestId('zoom-chip-1')).getByText('1.5x')).toBeTruthy();
});

test('拖动态大号倍数文字:<10 一位小数(2.0×)', () => {
  const { getByTestId } = r(
    <ZoomSlider {...baseProps} displayZoom={2} onSelect={() => {}} />
  );
  expect(within(getByTestId('zoom-big')).getByText('2.0×')).toBeTruthy();
});

test('拖动态大号倍数文字:≥10 取整(12×)', () => {
  const { getByTestId } = r(
    <ZoomSlider {...baseProps} displayZoom={12} onSelect={() => {}} />
  );
  expect(within(getByTestId('zoom-big')).getByText('12×')).toBeTruthy();
});
