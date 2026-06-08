import type { ReactElement } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import { ZoomChips } from './ZoomChips';

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
