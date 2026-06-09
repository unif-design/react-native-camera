import type { ReactElement } from 'react';
import { render, fireEvent, within } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import { ZoomChips } from '../../../camera/footer/ZoomChips';

// 相机 Modal 强制 dark,ZoomChips 用 useThemedStyles —— 包 dark Provider 对齐运行时。
const r = (ui: ReactElement) =>
  render(<ThemeProvider forceScheme="dark">{ui}</ThemeProvider>);

test('超广角设备渲染 3 档并可点选 2x', () => {
  const onSelect = jest.fn();
  const { getByTestId } = r(
    <ZoomChips zoom={1} onSelect={onSelect} minZoom={0.5} maxZoom={8} />
  );
  expect(getByTestId('zoom-chip-0.5')).toBeTruthy();
  expect(getByTestId('zoom-chip-1')).toBeTruthy();
  expect(getByTestId('zoom-chip-2')).toBeTruthy();
  fireEvent.press(getByTestId('zoom-chip-2'));
  expect(onSelect).toHaveBeenCalledWith(2);
});

test('minZoom=1（无超广角）不渲染 0.5 档,仍有 1/2', () => {
  const { queryByTestId } = r(
    <ZoomChips zoom={1} onSelect={() => {}} minZoom={1} maxZoom={8} />
  );
  expect(queryByTestId('zoom-chip-0.5')).toBeNull();
  expect(queryByTestId('zoom-chip-1')).toBeTruthy();
  expect(queryByTestId('zoom-chip-2')).toBeTruthy();
});
test('minZoom=0.5（有超广角）渲染 0.5 档', () => {
  const { queryByTestId } = r(
    <ZoomChips zoom={1} onSelect={() => {}} minZoom={0.5} maxZoom={8} />
  );
  expect(queryByTestId('zoom-chip-0.5')).toBeTruthy();
});
test('maxZoom<2 不渲染 2 档', () => {
  const { queryByTestId } = r(
    <ZoomChips zoom={1} onSelect={() => {}} minZoom={0.5} maxZoom={1.5} />
  );
  expect(queryByTestId('zoom-chip-2')).toBeNull();
});

// 区间高亮 + 实际倍数:当前档显示 zoom.toFixed(1)+'x',非当前档显示标称(.5/1/2)。
// 用 within(chip) 断言"实际倍数文字渲染在哪个档里"(即哪一档高亮)。

test('zoom<1 → 0.5 档高亮显示实际倍数,1/2 档显示标称', () => {
  const { getByTestId } = r(
    <ZoomChips zoom={0.9} onSelect={() => {}} minZoom={0.5} maxZoom={8} />
  );
  expect(within(getByTestId('zoom-chip-0.5')).getByText('0.9x')).toBeTruthy();
  expect(within(getByTestId('zoom-chip-1')).getByText('1')).toBeTruthy();
  expect(within(getByTestId('zoom-chip-2')).getByText('2')).toBeTruthy();
});

test('1≤zoom<2 → 1 档高亮显示实际倍数,0.5/2 显示标称', () => {
  const { getByTestId } = r(
    <ZoomChips zoom={1.5} onSelect={() => {}} minZoom={0.5} maxZoom={8} />
  );
  expect(within(getByTestId('zoom-chip-0.5')).getByText('.5')).toBeTruthy();
  expect(within(getByTestId('zoom-chip-1')).getByText('1.5x')).toBeTruthy();
  expect(within(getByTestId('zoom-chip-2')).getByText('2')).toBeTruthy();
});

test('zoom≥2 → 2 档高亮显示实际倍数', () => {
  const { getByTestId } = r(
    <ZoomChips zoom={3.4} onSelect={() => {}} minZoom={0.5} maxZoom={8} />
  );
  expect(within(getByTestId('zoom-chip-0.5')).getByText('.5')).toBeTruthy();
  expect(within(getByTestId('zoom-chip-1')).getByText('1')).toBeTruthy();
  expect(within(getByTestId('zoom-chip-2')).getByText('3.4x')).toBeTruthy();
});

test('无 0.5/2 档时(minZoom=1,maxZoom<2)1 档为当前档显示实际倍数', () => {
  const { getByTestId, queryByTestId } = r(
    <ZoomChips zoom={1.3} onSelect={() => {}} minZoom={1} maxZoom={1.6} />
  );
  expect(queryByTestId('zoom-chip-0.5')).toBeNull();
  expect(queryByTestId('zoom-chip-2')).toBeNull();
  expect(within(getByTestId('zoom-chip-1')).getByText('1.3x')).toBeTruthy();
});

test('zoom≥2 但无 2 档时,归到最大可用档(1 档)高亮', () => {
  const { getByTestId } = r(
    <ZoomChips zoom={2.5} onSelect={() => {}} minZoom={1} maxZoom={1.8} />
  );
  // 无 2 档:activeStop 落到 ≤zoom 的最大者 = 1
  expect(within(getByTestId('zoom-chip-1')).getByText('2.5x')).toBeTruthy();
});

test('点击 chip 仍跳到该档标称值(onSelect 传标称)', () => {
  const onSelect = jest.fn();
  const { getByTestId } = r(
    <ZoomChips zoom={1.5} onSelect={onSelect} minZoom={0.5} maxZoom={8} />
  );
  fireEvent.press(getByTestId('zoom-chip-0.5'));
  expect(onSelect).toHaveBeenCalledWith(0.5);
});
