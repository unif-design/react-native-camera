import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { r, useThemedStyles, useColors } from '@unif/react-native-design';

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
              icon="refresh"
              label="重拍"
              tone="neutral"
              onPress={onRetake}
              testID="retake-btn"
            />
            <PreviewActionButton
              icon="check"
              label="保存"
              tone="primary"
              onPress={onSave}
              testID="save-btn"
            />
          </>
        ) : (
          <>
            <PreviewActionButton
              icon="undo"
              label="返回"
              tone="neutral"
              onPress={onBack}
              testID="back-btn"
            />
            <PreviewActionButton
              icon="trash"
              label="删除"
              tone="danger"
              onPress={onDelete}
              testID="delete-btn"
              disabled={deleteDisabled}
            />
          </>
        )}
      </View>
    </View>
  );
}
