import { render } from '@testing-library/react-native';
import { WatermarkStamp } from './WatermarkStamp';

it('renders content lines + testID', () => {
  const { getByTestId, getByText } = render(
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
    render(
      <WatermarkStamp
        watermark={{ content: ['x'], position: 'bottom-center' }}
      />
    )
  ).not.toThrow();
});
