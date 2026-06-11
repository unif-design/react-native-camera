import { renderDark } from '../../__helpers__/renderDark';
import { WatermarkStamp } from '../../../camera/watermark/WatermarkStamp';

// 相机 Modal 强制 dark,WatermarkStamp 用 useThemedStyles —— renderDark 包 dark Provider 对齐运行时。

it('renders content lines + testID', () => {
  const { getByTestId, getByText } = renderDark(
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
    renderDark(
      <WatermarkStamp
        watermark={{ content: ['x'], position: 'bottom-center' }}
      />
    )
  ).not.toThrow();
});
