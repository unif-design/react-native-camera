import { StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  Icon,
  r,
  useColors,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';
import { VIEWFINDER } from '../colors/viewfinder';

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
    rail: {
      gap: r(8),
      padding: r(6),
      paddingVertical: r(10),
      borderRadius: r(26),
      // 药丸浮在明亮取景上:半透明黑底物理常量(design glass token 是半透白,不适用)。
      backgroundColor: VIEWFINDER.glassPill,
      borderWidth: 1,
      borderColor: c.glassSeparator,
    },
    btn: {
      width: r(40),
      height: r(40),
      borderRadius: r(999),
      alignItems: 'center',
      justifyContent: 'center',
    },
    save: { backgroundColor: c.primary },
    saveDisabled: { backgroundColor: c.glassSeparator },
  });
