import type { IconName } from '@unif/react-native-design';

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
  icon: IconName;
  label: string;
  tone: 'primary' | 'danger' | 'neutral';
  onPress: () => void;
  testID: string;
  disabled?: boolean;
}
