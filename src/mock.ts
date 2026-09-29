import { Fragment, createElement, useRef, type ReactElement } from 'react';
import type { CameraController } from './types';
export type * from './types';
export function useCamera(): readonly [CameraController, ReactElement] {
  const current = useRef<CameraController | null>(null);
  current.current ??= {
    open: jest.fn(async () => ({ status: 'cancelled' as const })),
  };
  return [current.current, createElement(Fragment)];
}
