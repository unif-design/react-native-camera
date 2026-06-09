import { AppState, type AppStateStatus } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';
import { useAppActive } from '../../../camera/hooks/useAppActive';

// 控制 AppState:捕获 change 监听器手动触发;currentState 用 spy 改写初值。
let handler: ((s: AppStateStatus) => void) | null = null;
const remove = jest.fn();

beforeEach(() => {
  handler = null;
  remove.mockClear();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((type, cb) => {
    if (type === 'change') handler = cb as (s: AppStateStatus) => void;
    return { remove } as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

function setCurrent(state: AppStateStatus) {
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    get: () => state,
  });
}

it('初值据 AppState.currentState:active → true', () => {
  setCurrent('active');
  const { result } = renderHook(() => useAppActive());
  expect(result.current).toBe(true);
});

it('初值据 AppState.currentState:background → false', () => {
  setCurrent('background');
  const { result } = renderHook(() => useAppActive());
  expect(result.current).toBe(false);
});

it('切后台 → false,回前台 → true', () => {
  setCurrent('active');
  const { result } = renderHook(() => useAppActive());
  expect(result.current).toBe(true);

  act(() => handler?.('background'));
  expect(result.current).toBe(false);

  act(() => handler?.('active'));
  expect(result.current).toBe(true);
});

it('inactive(iOS 来电/切换器)也视为非 active', () => {
  setCurrent('active');
  const { result } = renderHook(() => useAppActive());
  act(() => handler?.('inactive'));
  expect(result.current).toBe(false);
});

it('卸载时移除监听器', () => {
  setCurrent('active');
  const { unmount } = renderHook(() => useAppActive());
  unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});
