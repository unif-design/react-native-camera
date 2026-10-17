import { act, renderHook } from '@testing-library/react-native';
import { useVideoOutputController } from '../../../camera/video/useVideoOutputController';
let mockOutput: { createRecorder: jest.Mock };
jest.mock('react-native-vision-camera', () => ({
  useMicrophonePermission: () => ({
    hasPermission: true,
    requestPermission: async () => true,
  }),
  useVideoOutput: () => mockOutput,
}));
const options = { targetResolution: { width: 1920, height: 1080 } };
function request(callbacks = { onFinished: jest.fn(), onError: jest.fn() }) {
  return {
    hasMicrophonePermission: true,
    requestMicrophonePermission: async () => true,
    settings: {},
    callbacks,
  };
}
beforeEach(() => {
  mockOutput = {
    createRecorder: jest.fn().mockResolvedValue({
      filePath: '/v.mp4',
      recordedDuration: 0,
      startRecording: jest.fn().mockResolvedValue(undefined),
      stopRecording: jest.fn().mockResolvedValue(undefined),
      cancelRecording: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn(),
    }),
  };
});
it('configuration followed by synchronous cancellation never creates a native recorder', async () => {
  const h = renderHook(() => useVideoOutputController(options));
  let start!: Promise<'started' | 'denied'>;
  act(() => {
    start = h.result.current.controller.start(request());
    h.result.current.onConfigured();
    h.result.current.controller.cancel();
  });
  await act(async () => expect(await start).toBe('denied'));
  expect(mockOutput.createRecorder).not.toHaveBeenCalled();
});
it('stale native output errors cannot reject the replacement output preparation', async () => {
  const h = renderHook(() => useVideoOutputController(options));
  const oldError = h.result.current.onError;
  mockOutput = { ...mockOutput };
  h.rerender(undefined);
  const callbacks = { onFinished: jest.fn(), onError: jest.fn() };
  let start!: Promise<'started' | 'denied'>;
  act(() => {
    start = h.result.current.controller.start(request(callbacks));
    oldError(new Error('old output'));
    h.result.current.onConfigured();
  });
  await act(async () => expect(await start).toBe('started'));
  expect(mockOutput.createRecorder).toHaveBeenCalledTimes(1);
  expect(callbacks.onError).not.toHaveBeenCalled();
});
it('retry ignores an error from the prior configuration revision', async () => {
  const h = renderHook(() => useVideoOutputController(options));
  const oldError = h.result.current.onError;
  const failure = new Error('first configuration');
  let first!: Promise<'started' | 'denied'>;
  act(() => {
    first = h.result.current.controller.start(request());
    oldError(failure);
  });
  await act(async () => {
    await expect(first).rejects.toBe(failure);
  });
  let retry!: Promise<'started' | 'denied'>;
  act(() => {
    retry = h.result.current.controller.start(request());
  });
  act(() => {
    oldError(new Error('late first revision'));
    h.result.current.onConfigured();
  });
  await act(async () => expect(await retry).toBe('started'));
});

it('effect cleanup consumes a diagnostic failure from the real recorder teardown', async () => {
  const h = renderHook(() => useVideoOutputController(options));
  let start!: Promise<'started' | 'denied'>;
  act(() => {
    h.result.current.onConfigured();
    start = h.result.current.controller.start(request());
  });
  await act(async () => {
    await start;
  });
  const recorder = await mockOutput.createRecorder.mock.results[0]!.value;
  recorder.cancelRecording.mockRejectedValueOnce(
    new Error('native cancellation failed')
  );
  const actualTimeout = global.setTimeout;
  const timer = jest.spyOn(global, 'setTimeout').mockImplementation(((
    callback: () => void,
    delay?: number
  ) => {
    if (delay === 2000) throw new Error('timer unavailable');
    return actualTimeout(callback, delay);
  }) as typeof setTimeout);
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {
    throw new Error('diagnostic unavailable');
  });
  await act(async () => h.unmount());
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
  timer.mockRestore();
});
