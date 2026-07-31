import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { cancelledResult } from '../utils';
import type { CameraApi, CameraResult, OpenConfig } from '../utils';
import { validateOpenConfig } from '../utils/validateOpenConfig';
import { Container, ModalView } from '../camera';
import type {
  RegisterSessionContainer,
  RegisterSessionController,
  SessionControllerBridge,
} from '../camera/session/controllerBridge';
import {
  createFileRegistry,
  type FileRegistry,
} from '../camera/session/fileRegistry';

type RegisteredController = {
  bridge: SessionControllerBridge;
  active: boolean;
};

type RegisteredContainer = Record<string, never>;

type SessionResources = {
  files: FileRegistry;
  controller: RegisteredController | null;
  container: RegisteredContainer | null;
};

type SessionRecord = {
  id: number;
  config: OpenConfig;
  status: 'active' | 'settling' | 'settled';
  forceCancelRequested: boolean;
  resolve: (result: CameraResult) => void;
  resources: SessionResources;
};

type RenderedSession = Pick<SessionRecord, 'id' | 'config'> & {
  fileRegistry: FileRegistry;
};

type SessionContainerProps = React.ComponentProps<typeof Container> & {
  sessionId: number;
  fileRegistry: FileRegistry;
  registerContainer: RegisterSessionContainer;
  registerController: RegisterSessionController;
};

// Container 在状态机接线前尚未声明 session resources；这里先把真实边界送入渲染树。
const SessionContainer =
  Container as React.ComponentType<SessionContainerProps>;

export function useCamera(): [CameraApi, React.ReactElement] {
  const [visible, setVisible] = useState(false);
  const [renderedSession, setRenderedSession] =
    useState<RenderedSession | null>(null);
  const currentSessionRef = useRef<SessionRecord | null>(null);
  const renderedSessionRef = useRef<RenderedSession | null>(null);
  const nextSessionIdRef = useRef(0);
  const mountedRef = useRef(true);
  const mountGenerationRef = useRef(0);

  const finish = useCallback(
    (sessionId: number, result: CameraResult): void => {
      const session = currentSessionRef.current;
      if (session?.id !== sessionId || session.status !== 'active') {
        return;
      }

      session.status = 'settling';
      const finalResult =
        mountedRef.current && !session.forceCancelRequested
          ? result
          : cancelledResult();
      if (finalResult.code === 200) {
        session.resources.files.transfer(
          finalResult.data.map((file) => file.path)
        );
      }
      // drain 在首个 await 前同步摘除 owned；unlink I/O 永远不阻塞 Promise settle。
      session.resources.files.drain().catch((error) => {
        console.warn('camera session file cleanup failed', error);
      });
      currentSessionRef.current = null;
      session.status = 'settled';
      session.resolve(finalResult);

      if (!mountedRef.current || renderedSessionRef.current?.id !== sessionId) {
        return;
      }

      renderedSessionRef.current = null;
      setVisible(false);
      setRenderedSession(null);
    },
    []
  );

  const forceCancel = useCallback(
    (session: SessionRecord): void => {
      if (
        currentSessionRef.current !== session ||
        session.status !== 'active'
      ) {
        return;
      }
      if (session.forceCancelRequested) {
        finish(session.id, cancelledResult());
        return;
      }
      // 先锁定取消结果；teardown 同步重入的 save/onSettle 也只能得到 cancelled。
      session.forceCancelRequested = true;
      try {
        session.resources.controller?.bridge.forceTeardown();
      } catch (error) {
        console.warn('camera session force teardown failed', error);
      } finally {
        // bridge 可能同步回调 onSettle；ID/status 门禁保证这里重复 finish 仍是 no-op。
        finish(session.id, cancelledResult());
      }
    },
    [finish]
  );

  const cancelUnmountedGeneration = useCallback(
    (generation: number) => {
      if (mountedRef.current || mountGenerationRef.current !== generation) {
        return;
      }
      const session = currentSessionRef.current;
      if (session) forceCancel(session);
    },
    [forceCancel]
  );

  useEffect(() => {
    const generation = ++mountGenerationRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // React 19 StrictMode 会立即 replay effect；等一个 microtask，只有真实 unmount
      // 没有后继 generation 时才 teardown，避免开发环境误取消仍活跃的 session。
      queueMicrotask(() => cancelUnmountedGeneration(generation));
    };
  }, [cancelUnmountedGeneration]);

  const api = useMemo<CameraApi>(
    () => ({
      open: (config: OpenConfig) => {
        const validated = validateOpenConfig(config);
        if (!validated.ok) {
          return Promise.resolve(validated.result);
        }
        if (!mountedRef.current) {
          return Promise.resolve(cancelledResult());
        }

        const sessionId = ++nextSessionIdRef.current;
        const previousSession = currentSessionRef.current;
        if (previousSession) forceCancel(previousSession);

        return new Promise<CameraResult>((resolve) => {
          const files = createFileRegistry(RNFS.unlink);
          const session: SessionRecord = {
            id: sessionId,
            config: validated.config,
            status: 'active',
            forceCancelRequested: false,
            resolve,
            resources: { files, controller: null, container: null },
          };
          const nextRenderedSession = {
            id: session.id,
            config: session.config,
            fileRegistry: files,
          };

          currentSessionRef.current = session;
          renderedSessionRef.current = nextRenderedSession;
          setRenderedSession(nextRenderedSession);
          setVisible(true);
        });
      },
      close: () => {
        const session = currentSessionRef.current;
        if (session) forceCancel(session);
      },
    }),
    [forceCancel]
  );

  const requestUserCancel = useCallback(
    (sessionId: number): void => {
      const session = currentSessionRef.current;
      if (session?.id !== sessionId || session.status !== 'active') {
        return;
      }

      if (session.resources.controller) {
        try {
          if (session.resources.controller.active) {
            session.resources.controller.bridge.requestUserCancel();
            return;
          }
        } catch (error) {
          console.warn('camera session user cancel failed', error);
        }
      }

      finish(sessionId, cancelledResult());
    },
    [finish]
  );

  const registerController = useCallback<RegisterSessionController>(
    (sessionId, controller) => {
      const session = currentSessionRef.current;
      if (session?.id !== sessionId || session.status !== 'active') {
        return () => {};
      }
      const registration: RegisteredController = {
        bridge: controller,
        active: true,
      };
      session.resources.controller = registration;

      return () => {
        const currentSession = currentSessionRef.current;
        if (
          currentSession?.id !== sessionId ||
          currentSession.status !== 'active' ||
          currentSession.resources.controller !== registration
        ) {
          return;
        }
        registration.active = false;
        // effect cleanup 与 Container presence cleanup 同在一个 commit；推迟清空，
        // 让真实 detach 仍能 force teardown，StrictMode replay 的新注册则靠 identity 保住。
        queueMicrotask(() => {
          const latestSession = currentSessionRef.current;
          if (
            latestSession?.id !== sessionId ||
            latestSession.status !== 'active' ||
            latestSession.resources.controller !== registration ||
            latestSession.resources.container === null ||
            !mountedRef.current
          ) {
            return;
          }
          latestSession.resources.controller = null;
        });
      };
    },
    []
  );

  const registerContainer = useCallback<RegisterSessionContainer>(
    (sessionId) => {
      const session = currentSessionRef.current;
      if (session?.id !== sessionId || session.status !== 'active') {
        return () => {};
      }
      const registration: RegisteredContainer = {};
      session.resources.container = registration;

      return () => {
        const currentSession = currentSessionRef.current;
        if (
          currentSession?.id !== sessionId ||
          currentSession.status !== 'active' ||
          currentSession.resources.container !== registration
        ) {
          return;
        }
        currentSession.resources.container = null;
        queueMicrotask(() => {
          const detachedSession = currentSessionRef.current;
          if (
            detachedSession?.id === sessionId &&
            detachedSession.status === 'active' &&
            detachedSession.resources.container === null
          ) {
            forceCancel(detachedSession);
          }
        });
      };
    },
    [forceCancel]
  );

  const holder = (
    <ModalView
      visible={visible}
      onClose={() => {
        if (renderedSession) requestUserCancel(renderedSession.id);
      }}
    >
      {renderedSession && (
        <SessionContainer
          key={renderedSession.id}
          sessionId={renderedSession.id}
          fileRegistry={renderedSession.fileRegistry}
          config={renderedSession.config}
          onSettle={(result) => finish(renderedSession.id, result)}
          registerContainer={registerContainer}
          registerController={registerController}
        />
      )}
    </ModalView>
  );

  return [api, holder];
}
