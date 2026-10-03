import { useMemo } from 'react';
import type { CameraController } from './types';
export type * from './types';
export function useCamera(): readonly [CameraController, React.ReactElement] {
  const controller = useMemo<CameraController>(
    () => ({
      open: async () => ({
        status: 'failed',
        error: {
          reason: 'unsupported',
          message: 'Camera capture is not supported on Web',
        },
      }),
    }),
    []
  );
  return [controller, <></>];
}
