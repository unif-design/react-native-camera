import { renderHook } from '@testing-library/react-native';
import { useCreation } from '../hooks';

it('returns the same value across renders when deps unchanged', () => {
  let counter = 0;
  const { result, rerender } = renderHook(
    ({ d }: { d: number }) => useCreation(() => ++counter, [d]),
    { initialProps: { d: 1 } }
  );

  const first = result.current;
  rerender({ d: 1 });
  expect(result.current).toBe(first);
  expect(counter).toBe(1);
});

it('recreates value when deps change', () => {
  let counter = 0;
  const { result, rerender } = renderHook(
    ({ d }: { d: number }) => useCreation(() => ++counter, [d]),
    { initialProps: { d: 1 } }
  );

  expect(result.current).toBe(1);
  rerender({ d: 2 });
  expect(result.current).toBe(2);
  expect(counter).toBe(2);
});
