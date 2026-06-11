import { fireEvent } from '@testing-library/react-native';
import { renderDark } from '../__helpers__/renderDark';
import { NoPermission } from '../../camera/NoPermission';

// NoPermission = 权限被拒兜底(state 'denied' → code 403)。用 design Empty/Button +
// useThemedStyles → renderDark 包 dark Provider。验证渲染不崩 + 取消/去设置两按钮接线;
// onOpenSettings 缺省时不渲染「去设置」(条件渲染守护)。
// 注:design 在 jest 全被 mock(Empty=passthrough 丢 title、Button 把 label 当 prop),
// 故断言只认本组件自有 testID,不认 design 渲染的标题/label 文案。

it('渲染根容器与取消按钮,点取消触发 onCancel', () => {
  const onCancel = jest.fn();
  const { getByTestId } = renderDark(<NoPermission onCancel={onCancel} />);
  expect(getByTestId('no-permission')).toBeTruthy();
  fireEvent.press(getByTestId('cancel-btn'));
  expect(onCancel).toHaveBeenCalledTimes(1);
});

it('传 onOpenSettings 时渲染「去设置」并接线;不传则不渲染', () => {
  const onOpenSettings = jest.fn();
  const { getByTestId } = renderDark(
    <NoPermission onCancel={() => {}} onOpenSettings={onOpenSettings} />
  );
  fireEvent.press(getByTestId('open-settings-btn'));
  expect(onOpenSettings).toHaveBeenCalledTimes(1);

  const { queryByTestId } = renderDark(<NoPermission onCancel={() => {}} />);
  expect(queryByTestId('open-settings-btn')).toBeNull();
});
