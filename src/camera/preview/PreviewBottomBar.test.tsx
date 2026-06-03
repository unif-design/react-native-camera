import { render, fireEvent } from '@testing-library/react-native';
import { PreviewBottomBar } from './PreviewBottomBar';

it('confirm 变体: 重拍/保存', () => {
  const onRetake = jest.fn();
  const onSave = jest.fn();
  const { getByTestId } = render(
    <PreviewBottomBar
      variant="confirm"
      index={0}
      total={1}
      onRetake={onRetake}
      onSave={onSave}
      onBack={() => {}}
      onDelete={() => {}}
      onComplete={() => {}}
    />
  );
  fireEvent.press(getByTestId('retake-btn'));
  expect(onRetake).toHaveBeenCalled();
  fireEvent.press(getByTestId('save-btn'));
  expect(onSave).toHaveBeenCalled();
});

it('gallery 变体: 第X/Y张 + 返回/删除', () => {
  const onBack = jest.fn();
  const onDelete = jest.fn();
  const { getByTestId, getByText } = render(
    <PreviewBottomBar
      variant="gallery"
      index={1}
      total={3}
      onRetake={() => {}}
      onSave={() => {}}
      onBack={onBack}
      onDelete={onDelete}
      onComplete={() => {}}
    />
  );
  expect(getByText('第 2/3 张')).toBeTruthy();
  fireEvent.press(getByTestId('back-btn'));
  expect(onBack).toHaveBeenCalled();
  fireEvent.press(getByTestId('delete-btn'));
  expect(onDelete).toHaveBeenCalled();
});

test('gallery 含返回/删除/完成三按钮,完成可点', () => {
  const onComplete = jest.fn();
  const { getByTestId } = render(
    <PreviewBottomBar
      variant="gallery"
      index={0}
      total={2}
      onRetake={() => {}}
      onSave={() => {}}
      onBack={() => {}}
      onDelete={() => {}}
      onComplete={onComplete}
    />
  );
  expect(getByTestId('back-btn')).toBeTruthy();
  expect(getByTestId('delete-btn')).toBeTruthy();
  fireEvent.press(getByTestId('complete-btn'));
  expect(onComplete).toHaveBeenCalledTimes(1);
});
