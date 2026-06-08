import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, r } from '@unif/react-native-design';
import { DARK } from '../colors/dark';

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
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + r(20) }]}>
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

// 预览底部走相机黑底,计数文字 DARK 白;paddingBottom 由组件按底部安全区
// (home indicator)+ 基础 20 给,不走 useColors()。
const styles = StyleSheet.create({
  root: {
    paddingHorizontal: r(16),
    paddingTop: r(12),
    gap: r(12),
    alignItems: 'center',
  },
  counter: { color: DARK.white, fontSize: r(15), fontWeight: '600' },
  btns: { flexDirection: 'row', gap: r(12), justifyContent: 'center' },
});
