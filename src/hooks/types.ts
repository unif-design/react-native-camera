import type { CameraInput, CameraOutcome } from '../types';
import type { FileRegistry } from '../camera/session/fileRegistry';
import type { SessionControllerBridge } from '../camera/session/controllerBridge';
export interface RegisteredController {
  bridge: SessionControllerBridge;
  active: boolean;
}

export type RegisteredContainer = Record<string, never>;

export interface PendingContainerDetach {
  intent: object;
  controller: RegisteredController | null;
}

export interface SessionResources {
  files: FileRegistry;
  controller: RegisteredController | null;
  container: RegisteredContainer | null;
  pendingContainerDetach: PendingContainerDetach | null;
}

export interface SessionRecord {
  id: number;
  config: CameraInput;
  status: 'active' | 'settling' | 'settled';
  forceCancelRequested: boolean;
  pendingCancelIntents: Set<object>;
  teardownStarted: boolean;
  resolve: (result: CameraOutcome) => void;
  removeAbortListener?: () => void;
  resources: SessionResources;
}

export interface PendingHookUnmount {
  session: SessionRecord;
  intent: object;
  controller: RegisteredController | null;
}

export interface RenderedSession extends Pick<SessionRecord, 'id' | 'config'> {
  fileRegistry: FileRegistry;
}

export interface CameraHostPresenceProps {
  register(): () => void;
  children: import('react').ReactNode;
}
