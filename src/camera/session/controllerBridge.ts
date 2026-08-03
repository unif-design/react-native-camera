export type SessionControllerBridge = {
  requestUserCancel(): void;
  forceTeardown(): void;
};

export type RegisterSessionController = (
  sessionId: number,
  controller: SessionControllerBridge
) => () => void;

export type RegisterSessionContainer = (sessionId: number) => () => void;
