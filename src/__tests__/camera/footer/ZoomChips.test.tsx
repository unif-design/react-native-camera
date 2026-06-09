import type { ReactElement } from 'react';
import { render, fireEvent, within } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import { ZoomChips } from '../../../camera/footer/ZoomChips';

// 相机 Modal 强制 dark,ZoomChips 用 useThemedStyles —— 包 dark Provider 对齐运行时。
const r = (ui: ReactElement) =>
  render(<ThemeProvider forceScheme="dark">{ui}</ThemeProvider>);

// jest 下 useSharedValue 桩返 {value};zoomShared/pinching 直接造对象传入。
const base = {
  zoomShared: { value: 2 } as any, // vzf=2 → 后置 display=1.0x
  pinching: { value: 0 } as any,
  displayMul: 0.5,
};

test('超广角(showHalf)渲染 0.5/1 两档,无 2 档', () => {
  const onSelect = jest.fn();
  const { getByTestId, queryByTestId } = r(
    <ZoomChips {...base} showHalf onSelect={onSelect} />
  );
  expect(getByTestId('zoom-chip-0.5')).toBeTruthy();
  expect(getByTestId('zoom-chip-1')).toBeTruthy();
  // 2x 档已去除。
  expect(queryByTestId('zoom-chip-2')).toBeNull();
});

test('无超广角(showHalf=false)只渲染 1 档,无 0.5', () => {
  const { getByTestId, queryByTestId } = r(
    <ZoomChips {...base} displayMul={1} showHalf={false} onSelect={() => {}} />
  );
  expect(queryByTestId('zoom-chip-0.5')).toBeNull();
  expect(getByTestId('zoom-chip-1')).toBeTruthy();
});

test('点 0.5 档 → onSelect 传用户倍数 0.5', () => {
  const onSelect = jest.fn();
  const { getByTestId } = r(
    <ZoomChips {...base} showHalf onSelect={onSelect} />
  );
  fireEvent.press(getByTestId('zoom-chip-0.5'));
  expect(onSelect).toHaveBeenCalledWith(0.5);
});

test('点 1 档 → onSelect 传用户倍数 1', () => {
  const onSelect = jest.fn();
  const { getByTestId } = r(
    <ZoomChips {...base} showHalf onSelect={onSelect} />
  );
  fireEvent.press(getByTestId('zoom-chip-1'));
  expect(onSelect).toHaveBeenCalledWith(1);
});

test('档位标签静态:0.5 档显 .5、1 档显 1(实时倍数走大号 readout,不在档内)', () => {
  const { getByTestId } = r(
    <ZoomChips {...base} showHalf onSelect={() => {}} />
  );
  expect(within(getByTestId('zoom-chip-0.5')).getByText('.5')).toBeTruthy();
  expect(within(getByTestId('zoom-chip-1')).getByText('1')).toBeTruthy();
});

test('大号实时倍数(readout):vzf×displayMul 格式 1 位小数+x(vzf=2,mul=0.5→1.0x)', () => {
  const { getByTestId } = r(
    <ZoomChips {...base} showHalf onSelect={() => {}} />
  );
  // ZoomReadout 内 AnimatedTextInput 的 value 兜底初值 = (2×0.5).toFixed(1)+'x'。
  const readout = getByTestId('zoom-readout');
  expect(within(readout).getByDisplayValue('1.0x')).toBeTruthy();
});

test('readout 反映 0.5x(最广):vzf=1,mul=0.5 → 0.5x', () => {
  const { getByTestId } = r(
    <ZoomChips
      {...base}
      zoomShared={{ value: 1 } as any}
      showHalf
      onSelect={() => {}}
    />
  );
  expect(
    within(getByTestId('zoom-readout')).getByDisplayValue('0.5x')
  ).toBeTruthy();
});
