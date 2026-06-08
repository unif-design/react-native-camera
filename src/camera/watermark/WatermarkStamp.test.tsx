import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import { WatermarkStamp } from './WatermarkStamp';

// 相机 Modal 强制 dark,WatermarkStamp 用 useThemedStyles —— 包 dark Provider 对齐运行时。
const r = (ui: ReactElement) =>
  render(<ThemeProvider forceScheme="dark">{ui}</ThemeProvider>);

it('renders content lines + testID', () => {
  const { getByTestId, getByText } = r(
    <WatermarkStamp
      watermark={{ content: ['L1', 'L2'], position: 'top-right' }}
    />
  );
  expect(getByTestId('watermark-stamp')).toBeTruthy();
  expect(getByText('L1')).toBeTruthy();
  expect(getByText('L2')).toBeTruthy();
});

it('no crash for center/bottom', () => {
  expect(() =>
    r(
      <WatermarkStamp
        watermark={{ content: ['x'], position: 'bottom-center' }}
      />
    )
  ).not.toThrow();
});
