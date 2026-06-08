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
  /** 有照片才显示「保存」(无照片时只有返回)。 */
  canSave: boolean;
  onBack: () => void;
  onSave: () => void;
};

/** 左侧工具栏(SideRail)下方的返回 / 保存按钮组 —— 同款玻璃药丸 + 圆形按钮。
 *  返回 = 取消/放弃(替代原顶部关闭 X);保存 = 完成拍摄。 */
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
      {canSave && (
        <TouchableOpacity
          testID="side-save-btn"
          style={[styles.btn, styles.save]}
          onPress={onSave}
        >
          <Icon name="check" size={r(20)} color={c.foreground} />
        </TouchableOpacity>
      )}
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
  });
