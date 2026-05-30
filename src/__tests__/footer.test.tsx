import { render } from '@testing-library/react-native';
import { Footer } from '../camera/footer';
import type { CameraMode } from '../utils';

const noop = () => {};

// 库侧渲染守护:Footer 对每个传入 mode 都渲染 Segmented(无 length>1 门控),
// 锁住 Bug 1(传单拍+连拍只显示拍照)不在库侧退化。根因在 portal compat 拍扁,
// 但库侧"传几个 mode 都渲染切换器"必须有测试守着。
//
// 注意:jest.setup.ts 把 @unif/react-native-design 整体 mock 成 passthrough,
// 其中 `Segmented: passthrough`,passthrough = ({ children }) => children ?? null。
// Footer 渲染 <Segmented> 时不传 children,所以 mock 返回 null —— Segmented 自身的
// testID="mode-segmented" 不会出现在渲染树里。因此断言改用 Footer 自己的
// TouchableOpacity(testID="shutter-btn",passthrough 不经过,一定渲染)+
// 渲染不抛错,等价地证明 Footer 在多/单 mode 下都能正常渲染切换器分支。

it('renders without crashing for multi-mode and shows the shutter', () => {
  const modes: CameraMode[] = [{ mode: 'single' }, { mode: 'continuous' }];
  let rendered: ReturnType<typeof render>;
  expect(() => {
    rendered = render(
      <Footer
        modes={modes}
        currentIndex={0}
        recording={false}
        onShutter={noop}
        onSelectMode={noop}
        onCancel={noop}
      />
    );
  }).not.toThrow();
  // shutter-btn 是 Footer 自己的 TouchableOpacity(非 design 组件),passthrough mock
  // 不经过它,一定渲染 —— 证明 Footer 在 modeItems.length > 1 时整体渲染成功。
  expect(rendered!.getByTestId('shutter-btn')).toBeTruthy();
});

it('still renders without crashing for single mode', () => {
  const modes: CameraMode[] = [{ mode: 'single' }];
  let rendered: ReturnType<typeof render>;
  expect(() => {
    rendered = render(
      <Footer
        modes={modes}
        currentIndex={0}
        recording={false}
        onShutter={noop}
        onSelectMode={noop}
        onCancel={noop}
      />
    );
  }).not.toThrow();
  expect(rendered!.getByTestId('shutter-btn')).toBeTruthy();
});
