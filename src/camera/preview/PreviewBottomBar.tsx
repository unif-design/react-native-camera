import { StyleSheet, Text, View } from 'react-native';
import { Button, r, useThemedStyles } from '@unif/react-native-design';
import type { ColorTokens } from '@unif/react-native-design';

type Props = {
  variant: 'confirm' | 'gallery';
  index: number;
  total: number;
  onRetake: () => void;
  onSave: () => void;
  onBack: () => void;
  onDelete: () => void;
  onComplete: () => void;
};

export function PreviewBottomBar({
  variant,
  index,
  total,
  onRetake,
  onSave,
  onBack,
  onDelete,
  onComplete,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.root}>
      {variant === 'gallery' && (
        <Text style={styles.counter}>
          第 {index + 1}/{total} 张
        </Text>
      )}
      <View style={styles.btns}>
        {variant === 'confirm' ? (
          <>
            <Button
              variant="ghost"
              label="重拍"
              onPress={onRetake}
              testID="retake-btn"
            />
            <Button
              variant="primary"
              label="保存"
              onPress={onSave}
              testID="save-btn"
            />
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              label="返回"
              onPress={onBack}
              testID="back-btn"
            />
            <Button
              variant="danger"
              label="删除"
              onPress={onDelete}
              testID="delete-btn"
            />
            <Button
              variant="primary"
              label="完成"
              onPress={onComplete}
              testID="complete-btn"
            />
          </>
        )}
      </View>
    </View>
  );
}

const makeStyles = (c: ColorTokens) =>
  StyleSheet.create({
    root: {
      paddingHorizontal: r(16),
      paddingBottom: r(26),
      gap: r(12),
      alignItems: 'center',
    },
    counter: { color: c.foreground, fontSize: r(15), fontWeight: '600' },
    btns: { flexDirection: 'row', gap: r(12), justifyContent: 'center' },
  });
