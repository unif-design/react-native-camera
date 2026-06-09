import type { ReactElement } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import { PreviewBottomBar } from '../../../camera/preview/PreviewBottomBar';

// 相机 Modal 强制 dark,PreviewBottomBar 用 useThemedStyles —— 包 dark Provider 对齐运行时。
const r = (ui: ReactElement) =>
  render(<ThemeProvider forceScheme="dark">{ui}</ThemeProvider>);

it('confirm 变体: 重拍/保存', () => {
  const onRetake = jest.fn();
  const onSave = jest.fn();
  const { getByTestId } = r(
    <PreviewBottomBar
      variant="confirm"
      index={0}
      total={1}
      onRetake={onRetake}
      onSave={onSave}
      onBack={() => {}}
      onDelete={() => {}}
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
  const { getByTestId, getByText } = r(
    <PreviewBottomBar
      variant="gallery"
      index={1}
      total={3}
      onRetake={() => {}}
      onSave={() => {}}
      onBack={onBack}
      onDelete={onDelete}
    />
  );
  expect(getByText('第 2/3 张')).toBeTruthy();
  fireEvent.press(getByTestId('back-btn'));
  expect(onBack).toHaveBeenCalled();
  fireEvent.press(getByTestId('delete-btn'));
  expect(onDelete).toHaveBeenCalled();
});

test('gallery 只含返回/删除,无完成按钮', () => {
  const { getByTestId, queryByTestId } = r(
    <PreviewBottomBar
      variant="gallery"
      index={0}
      total={2}
      onRetake={() => {}}
      onSave={() => {}}
      onBack={() => {}}
      onDelete={() => {}}
    />
  );
  expect(getByTestId('back-btn')).toBeTruthy();
  expect(getByTestId('delete-btn')).toBeTruthy();
  expect(queryByTestId('complete-btn')).toBeNull();
});
