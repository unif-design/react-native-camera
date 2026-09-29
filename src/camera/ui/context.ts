import { createContext } from 'react';
import type { CameraDialog } from './types';

export const CameraDialogContext = createContext<CameraDialog | null>(null);
