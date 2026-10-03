import { useLayoutEffect } from 'react';
import type { CameraHostPresenceProps } from './types';
export function CameraHostPresence({
  register,
  children,
}: CameraHostPresenceProps) {
  useLayoutEffect(register, [register]);
  return <>{children}</>;
}
