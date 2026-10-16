import {
  CheckOutlined,
  RefreshOutlined,
  TrashOutlined,
  UndoOutlined,
} from '@unif/react-native-icons';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconButton,
  r,
  useThemedStyles,
  useColors,
} from '@unif/react-native-design';

import type { PreviewBottomBarProps } from './types';
import { PreviewActionButton } from './PreviewActionButton';
import { makePreviewBottomStyles } from './styles';

export function PreviewBottomBar({
  variant,
  index,
  total,
  onRetake,
  onSave,
  onBack,
  onDelete,
  deleteDisabled = false,
  deleteConfirmation,
}: PreviewBottomBarProps) {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const styles = useThemedStyles(makePreviewBottomStyles);
  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + r(20) }]}>
      {variant === 'gallery' && (
        <Text
          testID="preview-counter"
          style={[styles.counter, { color: c.foreground }]}
        >
          第 {index + 1}/{total} 张
        </Text>
      )}
      <View style={styles.btns}>
        {variant === 'confirm' ? (
          <>
            <PreviewActionButton
              icon={RefreshOutlined}
              label="重拍"
              tone="neutral"
              onPress={onRetake}
              testID="retake-btn"
            />
            <PreviewActionButton
              icon={CheckOutlined}
              label="保存"
              tone="primary"
              onPress={onSave}
              testID="save-btn"
            />
          </>
        ) : (
          <>
            <PreviewActionButton
              icon={UndoOutlined}
              label="返回"
              tone="neutral"
              onPress={onBack}
              testID="back-btn"
            />
            <View style={styles.item}>
              <IconButton
                icon={TrashOutlined}
                accessibilityLabel="删除"
                color={c.error}
                variant="glass"
                size="lg"
                surfaceSize={r(56)}
                iconSize={r(26)}
                onPress={onDelete}
                confirmation={deleteConfirmation ?? { label: '确认删除' }}
                testID="delete-btn"
                disabled={deleteDisabled}
              />
              <Text style={[styles.label, { color: c.foreground }]}>删除</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
