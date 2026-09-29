import type { ReactNode } from 'react';
import type { ConfirmOptions } from '@unif/react-native-design';

export interface CameraDialog {
  confirm(options: ConfirmOptions): Promise<boolean>;
  toast(message: string): void;
  showError(message: string): void;
}

export interface CameraDialogProviderProps {
  children: ReactNode;
}
