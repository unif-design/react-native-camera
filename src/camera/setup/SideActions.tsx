import { StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  Icon,
  r,
  useColors,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';
import { makeRailStyles } from './railStyles';

type Props = {
  /** 有照片时「保存」可点(橙底);无照片时保存常显但置灰 disabled。 */
  canSave: boolean;
  onBack: () => void;
  onSave: () => void;
};

/** 左侧工具栏(SideRail)下方的返回 / 保存按钮组 —— 同款玻璃药丸 + 圆形按钮。
 *  返回 = 取消/放弃(替代原顶部关闭 X);保存 = 完成拍摄。
 *  保存按钮始终渲染(未拍照时灰底 disabled,避免单按钮的视觉割裂)。 */
export function SideActions({ canSave, onBack, onSave }: Props) {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.rail}>
      <TouchableOpacity
        testID="side-back-btn"
        style={styles.btn}
        onPress={onBack}
      >
        <Icon name="undo" size={r(20)} color={c.foreground} />
      </TouchableOpacity>
      <TouchableOpacity
        testID="side-save-btn"
        style={[styles.btn, canSave ? styles.save : styles.saveDisabled]}
        onPress={onSave}
        disabled={!canSave}
      >
        <Icon
          name="check"
          size={r(20)}
          color={canSave ? c.foreground : c.foregroundMuted}
        />
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (c: ColorTokens) =>
  StyleSheet.create({
    ...makeRailStyles(c),
    save: { backgroundColor: c.primary },
    saveDisabled: { backgroundColor: c.glassSeparator },
  });
