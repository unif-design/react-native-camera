import React from 'react';
import { View } from 'react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { act, render } from '@testing-library/react-native';
import { useCamera } from '../hooks';
import type {
  CameraApi,
  CameraResult,
  CustomPhotoFile,
  OpenConfig,
} from '../utils';
import type { FileRegistry } from '../camera/session/fileRegistry';

type ControllerBridge = {
  requestUserCancel: () => void;
  forceTeardown: () => void;
};

type ContainerSnapshot = {
  config: OpenConfig;
  sessionId?: number;
  fileRegistry?: FileRegistry;
  onSettle: (result: CameraResult) => void;
  registerContainer?: (sessionId: number) => () => void;
  registerController?: (
    sessionId: number,
    controller: ControllerBridge
  ) => () => void;
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
      ReactModule.useEffect(() => {
        if (
          props.sessionId !== undefined &&
          props.registerContainer !== undefined
        ) {
          return props.registerContainer(props.sessionId);
        }

        // 复刻修复前真实 Container 的 cleanup：StrictMode replay 和真实 unmount
        // 都会同步 settle，用它保证 coordinator 测试能发现生产 cleanup 顺序回归。
        return () =>
          props.onSettle({ code: 0, data: [], message: 'cancelled' });
      }, [props.onSettle, props.registerContainer, props.sessionId]);
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
const mockUnlink = jest.mocked(RNFS.unlink);

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

function DetachableHolderHarness() {
  const [api, holder] = useCamera();
  const [holderMounted, setHolderMounted] = React.useState(true);
  currentApi = api;
  detachHolder = () => setHolderMounted(false);

  return holderMounted ? holder : <View testID="holder-detached" />;
}

function StrictModeOpenHarness({
  onOpen,
}: {
  onOpen: (promise: Promise<CameraResult>) => void;
}) {
  const [api, holder] = useCamera();
  const openedRef = React.useRef(false);
  currentApi = api;

  React.useLayoutEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    onOpen(api.open(createConfig()));
  }, [api, onOpen]);

  return holder;
}

let currentApi: CameraApi | null = null;
let detachHolder: (() => void) | null = null;

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

function registryOf(container: ContainerSnapshot): FileRegistry {
  if (!container.fileRegistry) {
    throw new Error('Container did not receive a file registry');
  }
  return container.fileRegistry;
}

function registerController(
  container: ContainerSnapshot,
  controller: ControllerBridge
): () => void {
  if (container.sessionId === undefined || !container.registerController) {
    throw new Error('Container did not receive a controller registrar');
  }

  let dispose: (() => void) | undefined;
  act(() => {
    dispose = container.registerController?.(
      container.sessionId as number,
      controller
    );
  });
  if (!dispose) throw new Error('controller registration returned no disposer');
  return dispose;
}

function createPhoto(path: string): CustomPhotoFile {
  return {
    id: path,
    cameraType: 'back',
    cameraMode: 'single',
    path,
    uri: `file://${path}`,
    width: 1080,
    height: 1440,
    mime: 'image/jpeg',
    mode: 'single',
    isRemake: false,
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
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
  detachHolder = null;
  mockContainerSnapshots.length = 0;
  mockModalSnapshots.length = 0;
  mockUnlink.mockReset();
  mockUnlink.mockResolvedValue(undefined);
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
  const secondContainer = latestContainer();
  await flushMicrotasks();

  expect(firstResolved).toHaveBeenCalledTimes(1);
  expect(firstResolved).toHaveBeenCalledWith(cancelledResult);
  expect(secondResolved).not.toHaveBeenCalled();
  expect(firstContainer.sessionId).toEqual(expect.any(Number));
  expect(secondContainer.sessionId).toBe(
    (firstContainer.sessionId as number) + 1
  );
  expect(secondContainer.config).toEqual(secondConfig);
  expect(secondContainer.config).not.toBe(secondConfig);
  expect(registryOf(secondContainer)).not.toBe(registryOf(firstContainer));
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
  expect(mockContainerSnapshots).toHaveLength(1);
});

it('transfers saved files and drains other owned files before resolving without waiting for unlink', async () => {
  const pendingUnlink = deferred();
  mockUnlink.mockImplementation(() => pendingUnlink.promise);
  render(<Harness />);
  const promise = open(createConfig());
  const container = latestContainer();
  const registry = registryOf(container);
  const savedPhoto = createPhoto('/returned.jpg');
  registry.register(savedPhoto.path);
  registry.register('/intermediate.jpg');

  act(() => {
    container.onSettle({
      code: 200,
      data: [savedPhoto],
      message: 'success',
    });
  });

  expect(registry.stateOf('/returned.jpg')).toBe('transferred');
  expect(registry.stateOf('/intermediate.jpg')).toBe('deleted');
  await expect(promise).resolves.toEqual({
    code: 200,
    data: [savedPhoto],
    message: 'success',
  });
  expect(mockUnlink).toHaveBeenCalledTimes(1);
  expect(mockUnlink).toHaveBeenCalledWith('/intermediate.jpg');

  pendingUnlink.resolve();
  await flushMicrotasks();
});

it('close synchronously drains owned files and settles without waiting for unlink', async () => {
  const pendingUnlink = deferred();
  mockUnlink.mockImplementation(() => pendingUnlink.promise);
  render(<Harness />);
  const promise = open(createConfig());
  const registry = registryOf(latestContainer());
  registry.register('/cancelled.jpg');

  act(() => getApi().close());

  expect(registry.stateOf('/cancelled.jpg')).toBe('deleted');
  await expect(promise).resolves.toEqual(cancelledResult);
  expect(mockUnlink).toHaveBeenCalledWith('/cancelled.jpg');

  pendingUnlink.resolve();
  await flushMicrotasks();
});

it('supersede drains only the old session registry', async () => {
  render(<Harness />);
  const firstPromise = open(createConfig());
  const firstRegistry = registryOf(latestContainer());
  firstRegistry.register('/old-session.jpg');

  const secondPromise = open(createConfig('video'));
  const secondRegistry = registryOf(latestContainer());
  secondRegistry.register('/new-session.mp4');

  await expect(firstPromise).resolves.toEqual(cancelledResult);
  expect(firstRegistry.stateOf('/old-session.jpg')).toBe('deleted');
  expect(secondRegistry.stateOf('/new-session.mp4')).toBe('owned');
  expect(mockUnlink).toHaveBeenCalledTimes(1);
  expect(mockUnlink).toHaveBeenCalledWith('/old-session.jpg');

  act(() => getApi().close());
  await expect(secondPromise).resolves.toEqual(cancelledResult);
});

it('real unmount drains its registry and settles without waiting for unlink', async () => {
  const pendingUnlink = deferred();
  mockUnlink.mockImplementation(() => pendingUnlink.promise);
  const view = render(<Harness />);
  const promise = open(createConfig());
  const registry = registryOf(latestContainer());
  registry.register('/unmounted.jpg');

  act(() => view.unmount());
  await flushMicrotasks();

  expect(registry.stateOf('/unmounted.jpg')).toBe('deleted');
  await expect(promise).resolves.toEqual(cancelledResult);
  expect(mockUnlink).toHaveBeenCalledWith('/unmounted.jpg');

  pendingUnlink.resolve();
  await flushMicrotasks();
});

it('real hook unmount force-tears down once before settling and draining', async () => {
  const view = render(<Harness />);
  const promise = open(createConfig());
  const container = latestContainer();
  const registry = registryOf(container);
  registry.register('/unmount-with-controller.jpg');
  const bridge: ControllerBridge = {
    requestUserCancel: jest.fn(),
    forceTeardown: jest.fn(),
  };
  registerController(container, bridge);

  act(() => view.unmount());
  await flushMicrotasks();

  await expect(promise).resolves.toEqual(cancelledResult);
  expect(bridge.forceTeardown).toHaveBeenCalledTimes(1);
  expect(registry.stateOf('/unmount-with-controller.jpg')).toBe('deleted');
  expect(mockUnlink).toHaveBeenCalledWith('/unmount-with-controller.jpg');
});

it('detaching the holder while the hook stays mounted force-cancels the session', async () => {
  render(<DetachableHolderHarness />);
  const promise = open(createConfig());
  const container = latestContainer();
  const bridge: ControllerBridge = {
    requestUserCancel: jest.fn(),
    forceTeardown: jest.fn(),
  };
  const disposeController = registerController(container, bridge);
  const registry = registryOf(container);
  registry.register('/detached-holder.jpg');

  act(() => {
    disposeController();
    if (!detachHolder) throw new Error('holder detach control is unavailable');
    detachHolder();
  });
  await flushMicrotasks();

  await expect(promise).resolves.toEqual(cancelledResult);
  expect(bridge.forceTeardown).toHaveBeenCalledTimes(1);
  expect(registry.stateOf('/detached-holder.jpg')).toBe('deleted');
});

it('unlink failure cannot change the exactly-once cancelled result', async () => {
  const unlinkError = new Error('disk busy');
  mockUnlink.mockRejectedValue(unlinkError);
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  render(<Harness />);
  const promise = open(createConfig());
  const registry = registryOf(latestContainer());
  registry.register('/cleanup-fails.jpg');

  act(() => getApi().close());

  await expect(promise).resolves.toEqual(cancelledResult);
  await flushMicrotasks();
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining('/cleanup-fails.jpg'),
    unlinkError
  );
  expect(registry.stateOf('/cleanup-fails.jpg')).toBe('deleted');
});

it('does not cancel an active session during React StrictMode effect replay', async () => {
  const onOpen = jest.fn<void, [Promise<CameraResult>]>();
  render(
    <React.StrictMode>
      <StrictModeOpenHarness onOpen={onOpen} />
    </React.StrictMode>
  );
  expect(onOpen).toHaveBeenCalledTimes(1);
  const promise = onOpen.mock.calls[0]?.[0];
  if (!promise) throw new Error('StrictMode harness did not open a session');
  const resolved = jest.fn();
  promise.then(resolved);

  await flushMicrotasks();

  expect(resolved).not.toHaveBeenCalled();
  const container = latestContainer();

  act(() => container.onSettle(savedResult));
  await expect(promise).resolves.toEqual(savedResult);
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

it('still force-tears down after hook unmount when stale settle wins before the queued microtask', async () => {
  const view = render(<Harness />);
  const promise = open(createConfig());
  const container = latestContainer();
  const registry = registryOf(container);
  registry.register('/stale-unmount.jpg');
  const bridge: ControllerBridge = {
    requestUserCancel: jest.fn(),
    forceTeardown: jest.fn(),
  };
  registerController(container, bridge);

  act(() => view.unmount());
  act(() => container.onSettle(savedResult));

  expect(bridge.forceTeardown).not.toHaveBeenCalled();
  expect(registry.stateOf('/stale-unmount.jpg')).toBe('deleted');
  await flushMicrotasks();

  await expect(promise).resolves.toEqual(cancelledResult);
  expect(bridge.forceTeardown).toHaveBeenCalledTimes(1);
});

it('locks holder detach to cancelled before stale save and still tears down once', async () => {
  render(<DetachableHolderHarness />);
  const promise = open(createConfig());
  const container = latestContainer();
  const registry = registryOf(container);
  const savedPhoto = createPhoto('/stale-detach-save.jpg');
  registry.register(savedPhoto.path);
  registry.register('/stale-detach-orphan.jpg');
  const bridge: ControllerBridge = {
    requestUserCancel: jest.fn(),
    forceTeardown: jest.fn(),
  };
  const disposeController = registerController(container, bridge);

  act(() => {
    disposeController();
    if (!detachHolder) throw new Error('holder detach control is unavailable');
    detachHolder();
  });
  act(() =>
    container.onSettle({
      code: 200,
      data: [savedPhoto],
      message: 'success',
    })
  );

  expect(bridge.forceTeardown).not.toHaveBeenCalled();
  expect(registry.stateOf(savedPhoto.path)).toBe('deleted');
  expect(registry.stateOf('/stale-detach-orphan.jpg')).toBe('deleted');
  await flushMicrotasks();

  await expect(promise).resolves.toEqual(cancelledResult);
  expect(bridge.forceTeardown).toHaveBeenCalledTimes(1);
  expect(mockUnlink).toHaveBeenCalledWith(savedPhoto.path);
  expect(mockUnlink).toHaveBeenCalledWith('/stale-detach-orphan.jpg');
});

it('queued holder detach tears down the controller captured by that presence', async () => {
  render(<DetachableHolderHarness />);
  const promise = open(createConfig());
  const container = latestContainer();
  const detachedBridge: ControllerBridge = {
    requestUserCancel: jest.fn(),
    forceTeardown: jest.fn(),
  };
  const replacementBridge: ControllerBridge = {
    requestUserCancel: jest.fn(),
    forceTeardown: jest.fn(),
  };
  registerController(container, detachedBridge);

  act(() => {
    if (!detachHolder) throw new Error('holder detach control is unavailable');
    detachHolder();
  });
  registerController(container, replacementBridge);
  await flushMicrotasks();

  await expect(promise).resolves.toEqual(cancelledResult);
  expect(detachedBridge.forceTeardown).toHaveBeenCalledTimes(1);
  expect(replacementBridge.forceTeardown).not.toHaveBeenCalled();
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

  registerController(container, bridge);
  act(() => {
    latestModal().onClose();
  });
  await flushMicrotasks();

  expect(bridge.requestUserCancel).toHaveBeenCalledTimes(1);
  expect(bridge.forceTeardown).not.toHaveBeenCalled();
  expect(resolved).not.toHaveBeenCalled();
});

it('keeps a replacement bridge when the previous bridge disposer runs late', async () => {
  render(<Harness />);
  const promise = open(createConfig());
  const container = latestContainer();
  const firstBridge: ControllerBridge = {
    requestUserCancel: jest.fn(),
    forceTeardown: jest.fn(),
  };
  const secondBridge: ControllerBridge = {
    requestUserCancel: jest.fn(),
    forceTeardown: jest.fn(),
  };
  const disposeFirst = registerController(container, firstBridge);
  registerController(container, secondBridge);

  act(() => {
    disposeFirst();
    latestModal().onClose();
  });

  expect(firstBridge.requestUserCancel).not.toHaveBeenCalled();
  expect(secondBridge.requestUserCancel).toHaveBeenCalledTimes(1);

  act(() => getApi().close());
  await expect(promise).resolves.toEqual(cancelledResult);
});

it('does not let delayed controller cleanup clear a replacement registration', async () => {
  render(<Harness />);
  const promise = open(createConfig());
  const container = latestContainer();
  const firstBridge: ControllerBridge = {
    requestUserCancel: jest.fn(),
    forceTeardown: jest.fn(),
  };
  const secondBridge: ControllerBridge = {
    requestUserCancel: jest.fn(),
    forceTeardown: jest.fn(),
  };
  const disposeFirst = registerController(container, firstBridge);

  act(() => disposeFirst());
  registerController(container, secondBridge);
  await flushMicrotasks();
  act(() => latestModal().onClose());

  expect(firstBridge.requestUserCancel).not.toHaveBeenCalled();
  expect(secondBridge.requestUserCancel).toHaveBeenCalledTimes(1);

  act(() => getApi().close());
  await expect(promise).resolves.toEqual(cancelledResult);
});

it('falls back to cancelled after the current bridge is disposed', async () => {
  render(<Harness />);
  const promise = open(createConfig());
  const bridge: ControllerBridge = {
    requestUserCancel: jest.fn(),
    forceTeardown: jest.fn(),
  };
  const dispose = registerController(latestContainer(), bridge);

  act(() => {
    dispose();
    latestModal().onClose();
  });

  await expect(promise).resolves.toEqual(cancelledResult);
  expect(bridge.requestUserCancel).not.toHaveBeenCalled();
});

it('ignores stale session registration and disposal after a new session owns the bridge', async () => {
  render(<Harness />);
  const firstPromise = open(createConfig());
  const firstContainer = latestContainer();
  const firstBridge: ControllerBridge = {
    requestUserCancel: jest.fn(),
    forceTeardown: jest.fn(),
  };
  const disposeFirst = registerController(firstContainer, firstBridge);

  const secondPromise = open(createConfig('video'));
  await expect(firstPromise).resolves.toEqual(cancelledResult);
  const secondContainer = latestContainer();
  const secondBridge: ControllerBridge = {
    requestUserCancel: jest.fn(),
    forceTeardown: jest.fn(),
  };
  registerController(secondContainer, secondBridge);
  const staleBridge: ControllerBridge = {
    requestUserCancel: jest.fn(),
    forceTeardown: jest.fn(),
  };
  const disposeStale = registerController(firstContainer, staleBridge);

  act(() => {
    disposeFirst();
    disposeStale();
    latestModal().onClose();
  });

  expect(firstBridge.requestUserCancel).not.toHaveBeenCalled();
  expect(staleBridge.requestUserCancel).not.toHaveBeenCalled();
  expect(secondBridge.requestUserCancel).toHaveBeenCalledTimes(1);

  act(() => getApi().close());
  await expect(secondPromise).resolves.toEqual(cancelledResult);
});

it('ignores an old session presence disposer after the new session mounts', async () => {
  render(<Harness />);
  const firstPromise = open(createConfig());
  const firstContainer = latestContainer();
  if (
    firstContainer.sessionId === undefined ||
    firstContainer.registerContainer === undefined
  ) {
    throw new Error('Container did not receive a presence registrar');
  }
  const staleDetach = firstContainer.registerContainer(
    firstContainer.sessionId
  );

  const secondPromise = open(createConfig('video'));
  const secondResolved = jest.fn();
  secondPromise.then(secondResolved);
  await expect(firstPromise).resolves.toEqual(cancelledResult);

  act(() => staleDetach());
  await flushMicrotasks();

  expect(secondResolved).not.toHaveBeenCalled();
  act(() => getApi().close());
  await expect(secondPromise).resolves.toEqual(cancelledResult);
});

it('uses force teardown for close, supersede, and unmount', async () => {
  const view = render(<Harness />);

  const closePromise = open(createConfig());
  const closeBridge: ControllerBridge = {
    requestUserCancel: jest.fn(),
    forceTeardown: jest.fn(),
  };
  registerController(latestContainer(), closeBridge);
  act(() => getApi().close());
  await expect(closePromise).resolves.toEqual(cancelledResult);
  expect(closeBridge.forceTeardown).toHaveBeenCalledTimes(1);

  open(createConfig());
  const supersededBridge: ControllerBridge = {
    requestUserCancel: jest.fn(),
    forceTeardown: jest.fn(),
  };
  registerController(latestContainer(), supersededBridge);
  const unmountPromise = open(createConfig('video'));
  await flushMicrotasks();
  expect(supersededBridge.forceTeardown).toHaveBeenCalledTimes(1);

  const unmountBridge: ControllerBridge = {
    requestUserCancel: jest.fn(),
    forceTeardown: jest.fn(),
  };
  registerController(latestContainer(), unmountBridge);
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
    registerController(latestContainer(), bridge);

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
  registerController(container, bridge);

  expect(() => {
    act(() => getApi().close());
  }).not.toThrow();
  await flushMicrotasks();

  expect(resolved).toHaveBeenCalledTimes(1);
  expect(resolved).toHaveBeenCalledWith(cancelledResult);
});

it('normalizes a saved result emitted reentrantly during force teardown to cancelled', async () => {
  render(<Harness />);
  const promise = open(createConfig());
  const container = latestContainer();
  const registry = registryOf(container);
  const savedPhoto = createPhoto('/reentrant-save.jpg');
  registry.register(savedPhoto.path);
  const bridge: ControllerBridge = {
    requestUserCancel: jest.fn(),
    forceTeardown: jest.fn(() => {
      container.onSettle({
        code: 200,
        data: [savedPhoto],
        message: 'success',
      });
    }),
  };
  registerController(container, bridge);

  act(() => getApi().close());

  await expect(promise).resolves.toEqual(cancelledResult);
  expect(bridge.forceTeardown).toHaveBeenCalledTimes(1);
  expect(registry.stateOf(savedPhoto.path)).toBe('deleted');
  expect(mockUnlink).toHaveBeenCalledWith(savedPhoto.path);
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
  registerController(latestContainer(), bridge);

  expect(() => {
    act(() => latestModal().onClose());
  }).not.toThrow();
  await flushMicrotasks();

  expect(bridge.requestUserCancel).toHaveBeenCalledTimes(1);
  expect(bridge.forceTeardown).not.toHaveBeenCalled();
  expect(resolved).toHaveBeenCalledTimes(1);
  expect(resolved).toHaveBeenCalledWith(cancelledResult);
});
