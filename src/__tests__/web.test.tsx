import { renderHook } from '@testing-library/react-native';
import { useCamera } from '../index.web';

it('keeps the web controller stable and reports unsupported capture', async () => {
  const hook = renderHook(() => useCamera());
  const controller = hook.result.current[0];
  await expect(
    controller.open({ modes: [{ mode: 'single' }], retention: 'clear' })
  ).resolves.toEqual({
    status: 'failed',
    error: {
      reason: 'unsupported',
      message: 'Camera capture is not supported on Web',
    },
  });
  hook.rerender({});
  expect(hook.result.current[0]).toBe(controller);
});
