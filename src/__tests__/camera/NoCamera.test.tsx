import { fireEvent } from '@testing-library/react-native';
import { renderDark } from '../__helpers__/renderDark';
import { NoCamera } from '../../camera/NoCamera';

// NoCamera = 无可用相机兜底(device==null → code 404/500)。用 design Empty/Button +
// useThemedStyles → renderDark 包 dark Provider 对齐运行时。验证渲染不崩 + 关闭回调接线。
// 注:design 在 jest 全被 mock(Empty=passthrough 丢 title、Button 把 label 当 prop),
// 故断言只认本组件自有 testID('no-camera'/'close-btn'),不认 design 渲染的标题/label 文案。

it('渲染根容器与关闭按钮,点关闭触发 onCancel', () => {
  const onCancel = jest.fn();
  const { getByTestId } = renderDark(<NoCamera onCancel={onCancel} />);
  expect(getByTestId('no-camera')).toBeTruthy();
  fireEvent.press(getByTestId('close-btn'));
  expect(onCancel).toHaveBeenCalledTimes(1);
});
