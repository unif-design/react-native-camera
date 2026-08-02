import { fireEvent } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import type {
  RegisterSessionContainer,
  RegisterSessionController,
} from '../../camera/session/controllerBridge';
import {
  createFileRegistry,
  type FileRegistry,
} from '../../camera/session/fileRegistry';

let nextSessionId = 1000;

export const DEFAULT_CAMERA_VIEWPORT = { width: 390, height: 844 } as const;

type CameraViewportQueries = {
  getByTestId: (testID: string) => ReactTestInstance;
};

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

export function layoutCameraViewport(
  queries: CameraViewportQueries,
  viewport: { width: number; height: number } = DEFAULT_CAMERA_VIEWPORT
): void {
  fireEvent(queries.getByTestId('camera-viewport'), 'layout', {
    nativeEvent: {
      layout: { x: 0, y: 0, ...viewport },
    },
  });
}
