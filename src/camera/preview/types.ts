import type { ComponentType } from 'react';
import type { IconProps } from '@unif/react-native-icons';
import type { IconButtonConfirmation } from '@unif/react-native-design';

export interface PreviewBottomBarProps {
  variant: 'confirm' | 'gallery';
  index: number;
  total: number;
  onRetake: () => void;
  onSave: () => void;
  onBack: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
  deleteConfirmation?: IconButtonConfirmation;
}

export interface PreviewActionButtonProps {
  icon: ComponentType<IconProps>;
  label: string;
  tone: 'primary' | 'neutral';
  onPress: () => void;
  testID: string;
  disabled?: boolean;
}
