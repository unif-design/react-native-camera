import { render, fireEvent } from '@testing-library/react-native';
import { TopBar } from './TopBar';

test('渲染取消按钮', () => {
  const { getByTestId } = render(<TopBar onCancel={() => {}} />);
  expect(getByTestId('cancel-btn')).toBeTruthy();
});

test('点 X 触发 onCancel', () => {
  const onCancel = jest.fn();
  const { getByTestId } = render(<TopBar onCancel={onCancel} />);
  fireEvent.press(getByTestId('cancel-btn'));
  expect(onCancel).toHaveBeenCalledTimes(1);
});
