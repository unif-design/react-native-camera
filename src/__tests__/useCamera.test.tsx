import React from 'react';
import { View } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { useCamera } from '../hooks';
import type { CameraApi, CameraResult, OpenConfig } from '../utils';

type ControllerBridge = {
  requestUserCancel: () => void;
  forceTeardown: () => void;
};

type ContainerSnapshot = {
  config: OpenConfig;
  sessionId?: number;
  onSettle: (result: CameraResult) => void;
  onControllerChange?: (controller: ControllerBridge | null) => void;
};

type ModalSnapshot = {
  visible: boolean;
  onClose: () => void;
};

const mockContainerSnapshots: ContainerSnapshot[] = [];
const mockModalSnapshots: ModalSnapshot[] = [];

jest.mock('../camera', () => {
  const ReactModule = require('react') as typeof React;
  const ReactNative = require('react-native') as typeof import('react-native');

  return {
    Container: (props: ContainerSnapshot) => {
      ReactModule.useEffect(() => {
        mockContainerSnapshots.push(props);
      }, [props]);
      return <ReactNative.View testID={`container-${props.sessionId}`} />;
    },
    ModalView: ({
      visible,
      onClose,
      children,
    }: React.PropsWithChildren<ModalSnapshot>) => {
      ReactModule.useEffect(() => {
        if (visible) mockModalSnapshots.push({ visible, onClose });
      }, [onClose, visible]);
      return visible ? (
        <ReactNative.View testID="camera-modal">{children}</ReactNative.View>
      ) : null;
    },
  };
});

const cancelledResult: CameraResult = {
  code: 0,
  data: [],
  message: 'cancelled',
};
const savedResult: CameraResult = {
  code: 200,
  data: [],
  message: 'success',
};

function createConfig(mode: 'single' | 'video' = 'single'): OpenConfig {
  return {
    cameraMode: [{ mode }],
    dataRetainedMode: 'clear',
  };
}

function Harness() {
  const [api, holder] = useCamera();
  currentApi = api;
  return (
    <>
      <View testID="harness-sentinel" />
      {holder}
    </>
  );
}

let currentApi: CameraApi | null = null;

function getApi(): CameraApi {
  if (!currentApi) throw new Error('camera API is not mounted');
  return currentApi;
}

function open(config: OpenConfig): Promise<CameraResult> {
  let promise: Promise<CameraResult> | undefined;
  act(() => {
    promise = getApi().open(config);
  });
  if (!promise) throw new Error('open did not return a promise');
  return promise;
}

function latestContainer(): ContainerSnapshot {
  const snapshot = mockContainerSnapshots.at(-1);
  if (!snapshot) throw new Error('Container was not rendered');
  return snapshot;
}

function latestModal(): ModalSnapshot {
  const snapshot = mockModalSnapshots.at(-1);
  if (!snapshot) throw new Error('Modal was not rendered');
  return snapshot;
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  currentApi = null;
  mockContainerSnapshots.length = 0;
  mockModalSnapshots.length = 0;
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('supersedes the old session before mounting an isolated new session', async () => {
  render(<Harness />);
  const firstConfig = createConfig();
  const firstPromise = open(firstConfig);
  const firstResolved = jest.fn();
  firstPromise.then(firstResolved);
  const firstContainer = latestContainer();

  const secondConfig = createConfig('video');
  const secondPromise = open(secondConfig);
  const secondResolved = jest.fn();
  secondPromise.then(secondResolved);
  await flushMicrotasks();

  expect(firstResolved).toHaveBeenCalledTimes(1);
  expect(firstResolved).toHaveBeenCalledWith(cancelledResult);
  expect(secondResolved).not.toHaveBeenCalled();
  expect(firstContainer.sessionId).toEqual(expect.any(Number));
  expect(latestContainer().sessionId).toBe(
    (firstContainer.sessionId as number) + 1
  );
  expect(latestContainer().config).toEqual(secondConfig);
  expect(latestContainer().config).not.toBe(secondConfig);
});

it('returns invalid_config without replacing the active valid session', async () => {
  render(<Harness />);
  const activePromise = open(createConfig());
  const activeResolved = jest.fn();
  activePromise.then(activeResolved);
  const activeContainer = latestContainer();

  const invalidPromise = open({
    cameraMode: [],
    dataRetainedMode: 'clear',
  });
  const invalidResolved = jest.fn();
  invalidPromise.then(invalidResolved);
  await flushMicrotasks();

  expect(invalidResolved).toHaveBeenCalledWith({
    code: 500,
    data: [],
    message: 'invalid_config',
  });
  expect(activeResolved).not.toHaveBeenCalled();
  expect(latestContainer()).toBe(activeContainer);
});

it('ignores stale Container settle and Modal close callbacks', async () => {
  render(<Harness />);
  const firstPromise = open(createConfig());
  const firstContainer = latestContainer();
  const firstModalClose = latestModal().onClose;

  const secondPromise = open(createConfig('video'));
  const secondResolved = jest.fn();
  secondPromise.then(secondResolved);
  await expect(firstPromise).resolves.toEqual(cancelledResult);

  act(() => {
    firstContainer.onSettle(savedResult);
    firstModalClose();
  });
  await flushMicrotasks();

  expect(secondResolved).not.toHaveBeenCalled();
  expect(latestContainer().sessionId).not.toBe(firstContainer.sessionId);
});

it.each([
  ['save → close → cleanup', ['save', 'close', 'cleanup'], savedResult],
  ['close → save → cleanup', ['close', 'save', 'cleanup'], cancelledResult],
  ['cleanup → save → close', ['cleanup', 'save', 'close'], cancelledResult],
] as const)('settles once for %s', async (_label, events, expectedResult) => {
  render(<Harness />);
  const promise = open(createConfig());
  const resolved = jest.fn();
  promise.then(resolved);
  const container = latestContainer();

  act(() => {
    for (const event of events) {
      if (event === 'save') container.onSettle(savedResult);
      if (event === 'close') getApi().close();
      if (event === 'cleanup') container.onSettle(cancelledResult);
    }
  });
  await flushMicrotasks();

  expect(resolved).toHaveBeenCalledTimes(1);
  expect(resolved).toHaveBeenCalledWith(expectedResult);
});

it('settles the active session on hook unmount without late state updates', async () => {
  const consoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  const view = render(<Harness />);
  const promise = open(createConfig());
  const resolved = jest.fn();
  promise.then(resolved);
  const staleContainer = latestContainer();

  act(() => view.unmount());
  act(() => staleContainer.onSettle(savedResult));
  await flushMicrotasks();

  expect(resolved).toHaveBeenCalledTimes(1);
  expect(resolved).toHaveBeenCalledWith(cancelledResult);
  expect(consoleError).not.toHaveBeenCalled();
});

it('routes hardware back through the current session user-cancel bridge', async () => {
  render(<Harness />);
  const promise = open(createConfig());
  const resolved = jest.fn();
  promise.then(resolved);
  const bridge: ControllerBridge = {
    requestUserCancel: jest.fn(),
    forceTeardown: jest.fn(),
  };
  const container = latestContainer();

  act(() => {
    container.onControllerChange?.(bridge);
    latestModal().onClose();
  });
  await flushMicrotasks();

  expect(bridge.requestUserCancel).toHaveBeenCalledTimes(1);
  expect(bridge.forceTeardown).not.toHaveBeenCalled();
  expect(resolved).not.toHaveBeenCalled();
});

it('uses force teardown for close, supersede, and unmount', async () => {
  const view = render(<Harness />);

  const closePromise = open(createConfig());
  const closeBridge: ControllerBridge = {
    requestUserCancel: jest.fn(),
    forceTeardown: jest.fn(),
  };
  act(() => latestContainer().onControllerChange?.(closeBridge));
  act(() => getApi().close());
  await expect(closePromise).resolves.toEqual(cancelledResult);
  expect(closeBridge.forceTeardown).toHaveBeenCalledTimes(1);

  open(createConfig());
  const supersededBridge: ControllerBridge = {
    requestUserCancel: jest.fn(),
    forceTeardown: jest.fn(),
  };
  act(() => latestContainer().onControllerChange?.(supersededBridge));
  const unmountPromise = open(createConfig('video'));
  await flushMicrotasks();
  expect(supersededBridge.forceTeardown).toHaveBeenCalledTimes(1);

  const unmountBridge: ControllerBridge = {
    requestUserCancel: jest.fn(),
    forceTeardown: jest.fn(),
  };
  act(() => latestContainer().onControllerChange?.(unmountBridge));
  act(() => view.unmount());
  await expect(unmountPromise).resolves.toEqual(cancelledResult);
  expect(unmountBridge.forceTeardown).toHaveBeenCalledTimes(1);
});

it.each(['close', 'supersede', 'unmount'] as const)(
  'settles cancelled when %s force teardown throws',
  async (action) => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const view = render(<Harness />);
    const promise = open(createConfig());
    const resolved = jest.fn();
    promise.then(resolved);
    const bridge: ControllerBridge = {
      requestUserCancel: jest.fn(),
      forceTeardown: jest.fn(() => {
        throw new Error('force teardown failed');
      }),
    };
    act(() => latestContainer().onControllerChange?.(bridge));

    expect(() => {
      act(() => {
        if (action === 'close') getApi().close();
        if (action === 'supersede') getApi().open(createConfig('video'));
        if (action === 'unmount') view.unmount();
      });
    }).not.toThrow();
    await flushMicrotasks();

    expect(bridge.forceTeardown).toHaveBeenCalledTimes(1);
    expect(resolved).toHaveBeenCalledTimes(1);
    expect(resolved).toHaveBeenCalledWith(cancelledResult);
  }
);

it('settles once when force teardown reentrantly settles before throwing', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  render(<Harness />);
  const promise = open(createConfig());
  const resolved = jest.fn();
  promise.then(resolved);
  const container = latestContainer();
  const bridge: ControllerBridge = {
    requestUserCancel: jest.fn(),
    forceTeardown: jest.fn(() => {
      container.onSettle(cancelledResult);
      throw new Error('force teardown failed after settle');
    }),
  };
  act(() => container.onControllerChange?.(bridge));

  expect(() => {
    act(() => getApi().close());
  }).not.toThrow();
  await flushMicrotasks();

  expect(resolved).toHaveBeenCalledTimes(1);
  expect(resolved).toHaveBeenCalledWith(cancelledResult);
});

it('falls back to cancelled when the user-cancel bridge throws', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  render(<Harness />);
  const promise = open(createConfig());
  const resolved = jest.fn();
  promise.then(resolved);
  const bridge: ControllerBridge = {
    requestUserCancel: jest.fn(() => {
      throw new Error('user cancel failed');
    }),
    forceTeardown: jest.fn(),
  };
  act(() => latestContainer().onControllerChange?.(bridge));

  expect(() => {
    act(() => latestModal().onClose());
  }).not.toThrow();
  await flushMicrotasks();

  expect(bridge.requestUserCancel).toHaveBeenCalledTimes(1);
  expect(bridge.forceTeardown).not.toHaveBeenCalled();
  expect(resolved).toHaveBeenCalledTimes(1);
  expect(resolved).toHaveBeenCalledWith(cancelledResult);
});
