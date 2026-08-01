import type {
  RegisterSessionContainer,
  RegisterSessionController,
} from '../../camera/session/controllerBridge';
import {
  createFileRegistry,
  type FileRegistry,
} from '../../camera/session/fileRegistry';

let nextSessionId = 1000;

export type ContainerSessionTestProps = {
  sessionId: number;
  fileRegistry: FileRegistry;
  registerContainer: RegisterSessionContainer;
  registerController: RegisterSessionController;
};

export function createContainerSessionProps(): ContainerSessionTestProps {
  return {
    sessionId: ++nextSessionId,
    fileRegistry: createFileRegistry(async () => {}),
    registerContainer: () => () => {},
    registerController: () => () => {},
  };
}
