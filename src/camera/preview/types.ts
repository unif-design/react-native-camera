import type { ComponentType } from 'react';
import type { IconProps } from '@unif/react-native-icons';

export interface PreviewBottomBarProps {
  variant: 'confirm' | 'gallery';
  index: number;
  total: number;
  onRetake: () => void;
  onSave: () => void;
  onBack: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
}

export interface PreviewActionButtonProps {
  icon: ComponentType<IconProps>;
  label: string;
  tone: 'primary' | 'danger' | 'neutral';
  onPress: () => void;
  testID: string;
  disabled?: boolean;
}
