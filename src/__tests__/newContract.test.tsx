import type { ComponentProps } from 'react';
import type { Container, ModalView } from '../camera';
import type { CameraInput, CameraOutcome } from '../types';
import { act, render, renderHook } from '@testing-library/react-native';
import { useCamera } from '../hooks';
import { validateOpenConfig } from '../utils/validateOpenConfig';

const mockSessions: ComponentProps<typeof Container>[] = [];
jest.mock('../camera', () => {
  const { View } = require('react-native');
  return {
    Container: (props: ComponentProps<typeof Container>) => {
      mockSessions.push(props);
      return null;
    },
    ModalView: ({ visible, children }: ComponentProps<typeof ModalView>) =>
      visible ? <View testID="camera-open">{children}</View> : null,
  };
});

let controller: ReturnType<typeof useCamera>[0];
function Host({ attached = true }: { attached?: boolean }) {
  const [api, holder] = useCamera();
  controller = api;
  return attached ? holder : null;
}
const input = {
  modes: [{ mode: 'single' }],
  retention: 'clear',
} as const satisfies CameraInput;
beforeEach(() => {
  mockSessions.length = 0;
});

test('accepts typed modes and snapshots watermark lines', () => {
  const source = {
    modes: [{ mode: 'single', quality: 0 }],
    retention: 'retain',
    watermark: { lines: ['原文'] },
  };
  const result = validateOpenConfig(source);
  expect(result.ok).toBe(true);
  source.watermark.lines[0] = '已修改';
  if (result.ok) expect(result.config.watermark).toEqual({ lines: ['原文'] });
});

test.each([
  { modes: [{ mode: 'single' }, { mode: 'single' }], retention: 'clear' },
  { modes: [{ mode: 'video', quality: 0.5 }], retention: 'clear' },
  { modes: [{ mode: 'single', bitRate: 100 }], retention: 'clear' },
])('rejects duplicate modes or options for the wrong capture type', (value) => {
  expect(validateOpenConfig(value)).toMatchObject({
    ok: false,
    result: { status: 'failed', error: { reason: 'invalid_input' } },
  });
});

test('open without a rendered host fails immediately', async () => {
  const { result } = renderHook(() => useCamera());
  const pending = result.current[0].open(input);
  expect(
    await Promise.race([pending, Promise.resolve('pending')])
  ).toMatchObject({ status: 'failed', error: { reason: 'unavailable' } });
});

test('an already cancelled call does not replace the active interaction', async () => {
  const view = render(<Host />);
  let first!: Promise<CameraOutcome>;
  act(() => {
    first = controller.open(input);
  });
  expect(view.getByTestId('camera-open')).toBeTruthy();
  const signal = new AbortController();
  signal.abort();
  let cancelled!: Promise<CameraOutcome>;
  act(() => {
    cancelled = controller.open(input, { signal: signal.signal });
  });
  expect(await cancelled).toEqual({ status: 'cancelled' });
  expect(view.getByTestId('camera-open')).toBeTruthy();
  act(() => mockSessions.at(-1)!.onSettle({ status: 'cancelled' }));
  expect(await first).toEqual({ status: 'cancelled' });
});

test('an old AbortSignal cannot cancel a replacement interaction', async () => {
  render(<Host />);
  const old = new AbortController();
  const current = new AbortController();
  let first!: Promise<CameraOutcome>;
  let second!: Promise<CameraOutcome>;
  act(() => {
    first = controller.open(input, { signal: old.signal });
  });
  act(() => {
    second = controller.open(input, { signal: current.signal });
  });
  expect(await first).toEqual({ status: 'cancelled' });
  act(() => old.abort());
  expect(await Promise.race([second, Promise.resolve('pending')])).toBe(
    'pending'
  );
  act(() => current.abort());
  expect(await second).toEqual({ status: 'cancelled' });
});

test('success hands off only public media and survives a late cancellation', async () => {
  render(<Host />);
  const cancellation = new AbortController();
  let result!: Promise<CameraOutcome>;
  act(() => {
    result = controller.open(input, { signal: cancellation.signal });
  });
  const session = mockSessions.at(-1)!;
  act(() =>
    session.onSettle({
      status: 'success',
      media: [
        {
          id: 'photo-1',
          path: '/tmp/photo.jpg',
          uri: 'file:///tmp/photo.jpg',
          mode: 'single',
          facing: 'front',
          mimeType: 'image/jpeg',
          width: 1080,
          height: 1920,
        },
      ],
    })
  );
  act(() => cancellation.abort());
  expect(await result).toEqual({
    status: 'success',
    media: [
      {
        id: 'photo-1',
        uri: 'file:///tmp/photo.jpg',
        mode: 'single',
        facing: 'front',
        mimeType: 'image/jpeg',
        width: 1080,
        height: 1920,
      },
    ],
  });
});

test('an invalid call leaves the active interaction usable', async () => {
  render(<Host />);
  let first!: Promise<CameraOutcome>;
  act(() => {
    first = controller.open(input);
  });
  await expect(
    controller.open({ modes: [], retention: 'clear' })
  ).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'invalid_input' },
  });
  expect(await Promise.race([first, Promise.resolve('pending')])).toBe(
    'pending'
  );
  act(() => mockSessions.at(-1)!.onSettle({ status: 'cancelled' }));
  expect(await first).toEqual({ status: 'cancelled' });
});

test('removing the host cancels its call and a retained controller fails promptly', async () => {
  const view = render(<Host />);
  let pending!: Promise<CameraOutcome>;
  act(() => {
    pending = controller.open(input);
  });
  const oldSession = mockSessions.at(-1)!;
  view.rerender(<Host attached={false} />);
  act(() => oldSession.onSettle({ status: 'success', media: [] }));
  expect(await pending).toEqual({ status: 'cancelled' });
  await expect(controller.open(input)).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'unavailable' },
  });
});

test.each([0.5, 2 ** 31, Number.MAX_VALUE])(
  'rejects bitrate %s that the native encoders cannot represent',
  (bitRate) => {
    expect(
      validateOpenConfig({
        modes: [{ mode: 'video', bitRate }],
        retention: 'clear',
      })
    ).toMatchObject({
      ok: false,
      result: { error: { reason: 'invalid_input' } },
    });
  }
);
