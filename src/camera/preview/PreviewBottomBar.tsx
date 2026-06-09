import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Icon,
  r,
  rf,
  useColors,
  type IconName,
} from '@unif/react-native-design';
import { VIEWFINDER } from '../colors/viewfinder';

type Props = {
  variant: 'confirm' | 'gallery';
  index: number;
  total: number;
  onRetake: () => void;
  onSave: () => void;
  onBack: () => void;
  onDelete: () => void;
};

export function PreviewBottomBar({
  variant,
  index,
  total,
  onRetake,
  onSave,
  onBack,
  onDelete,
}: Props) {
  const insets = useSafeAreaInsets();
  const c = useColors();
  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + r(20) }]}>
      {variant === 'gallery' && (
        <Text style={[styles.counter, { color: c.foreground }]}>
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
            />
          </>
        )}
      </View>
    </View>
  );
}

// 扫一扫式「上 icon 下文字」圆形按钮:圆形实色图标盘 + 下方标签。
// tone 决定圆底色:primary=橙(c.primary)、danger=红(c.error)、neutral=半透明深
// (VIEWFINDER.glassPill,相机物理常量——浮在明亮取景/黑底预览上需半透明黑)。
function PreviewActionButton({
  icon,
  label,
  tone,
  onPress,
  testID,
}: {
  icon: IconName;
  label: string;
  tone: 'primary' | 'danger' | 'neutral';
  onPress: () => void;
  testID: string;
}) {
  const c = useColors();
  const bg =
    tone === 'primary'
      ? c.primary
      : tone === 'danger'
        ? c.error
        : VIEWFINDER.glassPill;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.circle,
          { backgroundColor: bg, borderColor: c.glassPillBorder },
        ]}
      >
        <Icon name={icon} size={r(22)} color={c.foreground} />
      </View>
      <Text style={[styles.label, { color: c.foreground }]}>{label}</Text>
    </Pressable>
  );
}

// 预览底部走相机黑底,计数文字 / 按钮文字用 foreground token(Modal 强制 dark → 恒白);
// paddingBottom 由组件按底部安全区(home indicator)+ 基础 20 给。
const styles = StyleSheet.create({
  root: {
    paddingHorizontal: r(16),
    paddingTop: r(12),
    gap: r(12),
    alignItems: 'center',
  },
  counter: { fontSize: r(15), fontWeight: '600' },
  btns: {
    flexDirection: 'row',
    justifyContent: 'center',
    columnGap: r(40),
  },
  item: { alignItems: 'center', rowGap: r(7) },
  circle: {
    width: r(52),
    height: r(52),
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: rf(12),
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
