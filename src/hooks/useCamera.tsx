import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cancelledResult } from '../utils';
import type { CameraApi, CameraResult, OpenConfig } from '../utils';
import { validateOpenConfig } from '../utils/validateOpenConfig';
import { Container, ModalView } from '../camera';

export type SessionControllerBridge = {
  requestUserCancel(): void;
  forceTeardown(): void;
};

type SessionResources = {
  controller: SessionControllerBridge | null;
};

type SessionRecord = {
  id: number;
  config: OpenConfig;
  status: 'active' | 'settling' | 'settled';
  resolve: (result: CameraResult) => void;
  resources: SessionResources;
};

type RenderedSession = Pick<SessionRecord, 'id' | 'config'>;

type SessionContainerProps = React.ComponentProps<typeof Container> & {
  sessionId: number;
  onControllerChange(controller: SessionControllerBridge | null): void;
};

// Task 1 先把 session identity 与 controller 注册入口送到 Container 边界；
// 后续状态机接入时 Container 会显式消费这两个 prop。
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

  const finish = useCallback(
    (sessionId: number, result: CameraResult): void => {
      const session = currentSessionRef.current;
      if (session?.id !== sessionId || session.status !== 'active') {
        return;
      }

      session.status = 'settling';
      currentSessionRef.current = null;
      session.status = 'settled';
      session.resolve(result);

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
      try {
        session.resources.controller?.forceTeardown();
      } catch (error) {
        console.warn('camera session force teardown failed', error);
      } finally {
        // bridge 可能同步回调 onSettle；ID/status 门禁保证这里重复 finish 仍是 no-op。
        finish(session.id, cancelledResult());
      }
    },
    [finish]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const session = currentSessionRef.current;
      if (session) forceCancel(session);
    };
  }, [forceCancel]);

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
          const session: SessionRecord = {
            id: sessionId,
            config: validated.config,
            status: 'active',
            resolve,
            resources: { controller: null },
          };
          const nextRenderedSession = {
            id: session.id,
            config: session.config,
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
          session.resources.controller.requestUserCancel();
          return;
        } catch (error) {
          console.warn('camera session user cancel failed', error);
        }
      }

      finish(sessionId, cancelledResult());
    },
    [finish]
  );

  const setController = useCallback(
    (sessionId: number, controller: SessionControllerBridge | null): void => {
      const session = currentSessionRef.current;
      if (session?.id !== sessionId || session.status !== 'active') {
        return;
      }
      session.resources.controller = controller;
    },
    []
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
          config={renderedSession.config}
          onSettle={(result) => finish(renderedSession.id, result)}
          onControllerChange={(controller) =>
            setController(renderedSession.id, controller)
          }
        />
      )}
    </ModalView>
  );

  return [api, holder];
}
