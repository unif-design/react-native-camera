import { render, fireEvent } from '@testing-library/react-native';
import { SideActions } from './SideActions';

it('返回按钮触发 onBack', () => {
  const onBack = jest.fn();
  const { getByTestId } = render(
    <SideActions canSave={false} onBack={onBack} onSave={() => {}} />
  );
  fireEvent.press(getByTestId('side-back-btn'));
  expect(onBack).toHaveBeenCalled();
});

it('canSave=false 不渲染保存按钮', () => {
  const { queryByTestId } = render(
    <SideActions canSave={false} onBack={() => {}} onSave={() => {}} />
  );
  expect(queryByTestId('side-save-btn')).toBeNull();
});

it('canSave=true 渲染保存按钮并触发 onSave', () => {
  const onSave = jest.fn();
  const { getByTestId } = render(
    <SideActions canSave onBack={() => {}} onSave={onSave} />
  );
  fireEvent.press(getByTestId('side-save-btn'));
  expect(onSave).toHaveBeenCalled();
});
