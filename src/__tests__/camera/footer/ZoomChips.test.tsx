import { fireEvent, within } from '@testing-library/react-native';
import type { SharedValue } from 'react-native-reanimated';
import { renderDark } from '../../__helpers__/renderDark';
import { ZoomChips } from '../../../camera/footer/ZoomChips';

// 相机 Modal 强制 dark,ZoomChips 用 useThemedStyles —— renderDark 包 dark Provider 对齐运行时。

// jest 下 useSharedValue 桩返 {value};zoomShared 直接造 {value} 桩传入(pinching 已从 props 移除)。
// 桩只需 .value 字段,故 as unknown as SharedValue<number>(不引入完整 SharedValue 形状)。
const sharedStub = (value: number) =>
  ({ value }) as unknown as SharedValue<number>;
const base = {
  zoomShared: sharedStub(2), // vzf=2 → 后置 display=1.0x
  displayMul: 0.5,
};

test('超广角(showHalf)渲染 0.5/1 两档,无 2 档', () => {
  const onSelect = jest.fn();
  const { getByTestId, queryByTestId } = renderDark(
    <ZoomChips {...base} showHalf onSelect={onSelect} />
  );
  expect(getByTestId('zoom-chip-0.5')).toBeTruthy();
  expect(getByTestId('zoom-chip-1')).toBeTruthy();
  // 2x 档已去除。
  expect(queryByTestId('zoom-chip-2')).toBeNull();
});

test('无超广角(showHalf=false)只渲染 1 档,无 0.5', () => {
  const { getByTestId, queryByTestId } = renderDark(
    <ZoomChips {...base} displayMul={1} showHalf={false} onSelect={() => {}} />
  );
  expect(queryByTestId('zoom-chip-0.5')).toBeNull();
  expect(getByTestId('zoom-chip-1')).toBeTruthy();
});

test('点 0.5 档 → onSelect 传用户倍数 0.5', () => {
  const onSelect = jest.fn();
  const { getByTestId } = renderDark(
    <ZoomChips {...base} showHalf onSelect={onSelect} />
  );
  fireEvent.press(getByTestId('zoom-chip-0.5'));
  expect(onSelect).toHaveBeenCalledWith(0.5);
});

test('点 1 档 → onSelect 传用户倍数 1', () => {
  const onSelect = jest.fn();
  const { getByTestId } = renderDark(
    <ZoomChips {...base} showHalf onSelect={onSelect} />
  );
  fireEvent.press(getByTestId('zoom-chip-1'));
  expect(onSelect).toHaveBeenCalledWith(1);
});

// 倍数已挪进**当前高亮档**药丸文字本身(删了上方大号 readout 浮层):
// 高亮档 = display 值(toFixed(1)),非高亮档 = 静态 0.5 / 1.0(等长一位小数,消除闪烁)。
// chip 文字现为只读 AnimatedTextInput(value 兜底初值,jest 用 getByDisplayValue 取)。
test('display=1.0(vzf2×0.5):高亮 1 档文字=实时 1.0,0.5 档静态 0.5', () => {
  const { getByTestId } = renderDark(
    <ZoomChips {...base} showHalf onSelect={() => {}} />
  );
  // 1 档高亮 → 文字实时 = (2×0.5).toFixed(1) = '1.0'。
  expect(
    within(getByTestId('zoom-chip-1')).getByDisplayValue('1.0')
  ).toBeTruthy();
  // 0.5 档非高亮 → 静态 '0.5'。
  expect(
    within(getByTestId('zoom-chip-0.5')).getByDisplayValue('0.5')
  ).toBeTruthy();
});

test('display=0.5(vzf1×0.5,最广):高亮 0.5 档文字=实时 0.5,1 档静态 1', () => {
  const { getByTestId } = renderDark(
    <ZoomChips
      {...base}
      zoomShared={sharedStub(1)}
      showHalf
      onSelect={() => {}}
    />
  );
  // 0.5 档高亮 → 文字实时 = (1×0.5).toFixed(1) = '0.5'。
  expect(
    within(getByTestId('zoom-chip-0.5')).getByDisplayValue('0.5')
  ).toBeTruthy();
  // 1 档非高亮 → 静态 '1.0'。
  expect(
    within(getByTestId('zoom-chip-1')).getByDisplayValue('1.0')
  ).toBeTruthy();
});

test('中间倍数 display=0.7(vzf1.4×0.5):高亮 0.5 档实时文字 animatedProps.text=0.7', () => {
  const { getByTestId } = renderDark(
    <ZoomChips
      {...base}
      zoomShared={sharedStub(1.4)}
      showHalf
      onSelect={() => {}}
    />
  );
  // reanimated 合规后:档位文字 defaultValue 是静态档位('0.5'),实时倍数由 animatedProps.text
  // (worklet 读 zoomShared)驱动 —— 不再在 render 读 .value。display=0.7 < 1 → 0.5 档高亮,
  // 实时 = (1.4×0.5).toFixed(1) = '0.7'。jest 下 TextInput 不消费 animatedProps,故读 props.animatedProps.text。
  const input = within(getByTestId('zoom-chip-0.5')).getByDisplayValue('0.5');
  const ap = (input.props as { animatedProps?: { text?: string } })
    .animatedProps;
  expect(ap?.text).toBe('0.7');
});

test('删除上方大号 readout 浮层(zoom-readout 不再渲染)', () => {
  const { queryByTestId } = renderDark(
    <ZoomChips {...base} showHalf onSelect={() => {}} />
  );
  expect(queryByTestId('zoom-readout')).toBeNull();
});
