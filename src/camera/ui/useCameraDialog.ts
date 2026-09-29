import { useContext } from 'react';
import { CameraDialogContext } from './context';

export function useCameraDialog() {
  const dialog = useContext(CameraDialogContext);
  if (!dialog) {
    throw new Error('useCameraDialog must be used within CameraDialogProvider');
  }
  return dialog;
}
