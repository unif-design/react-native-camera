import { renderDark } from '../__helpers__/renderDark';
import { Loading } from '../../components/Loading';

// Loading = 权限请求中 / 烧水印时的 spinner(design Spinner)。用 design 组件 → renderDark
// 包 dark Provider。最小冒烟:渲染不崩 + testID 'loading' 在。

it('渲染 spinner 不崩,testID loading 在', () => {
  const { getByTestId } = renderDark(<Loading />);
  expect(getByTestId('loading')).toBeTruthy();
});
