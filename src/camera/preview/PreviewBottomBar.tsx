import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Icon,
  r,
  fw,
  type as t,
  useColors,
  type IconName,
} from '@unif/react-native-design';

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
            />
          </>
        )}
      </View>
    </View>
  );
}

// 扫一扫式「上 icon 下文字」圆形按钮:圆形实色图标盘 + 下方标签。
// tone 决定圆底色:primary=橙(c.primary)、danger=红(c.error)、neutral=半透明浅灰白
// (c.glassHighlight dark=rgba(255,255,255,0.24))—— 预览黑底上要可见,与橙对称;
// 不再用 VIEWFINDER.glassPill 黑底(在黑底预览上几乎看不见)。
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
        : c.glassHighlight;
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
        <Icon name={icon} size={r(26)} color={c.foreground} />
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
  counter: { fontSize: t.body, fontWeight: fw.semi },
  btns: {
    flexDirection: 'row',
    justifyContent: 'center',
    columnGap: r(40),
  },
  item: { alignItems: 'center', rowGap: r(7) },
  circle: {
    // trash(垃圾桶,3 条 stroke)在小尺寸会挤一起糊成一团 → 图标 r(26) 取清晰,
    // 圆盘相应放大到 r(56) 让图标透气(见上 Icon size)。
    width: r(56),
    height: r(56),
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: t.xxs,
    fontWeight: fw.medium,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
