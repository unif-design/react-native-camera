import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Icon, r } from '@unif/react-native-design';
import { DARK } from '../colors/dark';

type Props = {
  /** 有照片才显示「保存」(无照片时只有返回)。 */
  canSave: boolean;
  onBack: () => void;
  onSave: () => void;
};

/** 左侧工具栏(SideRail)下方的返回 / 保存按钮组 —— 同款 DARK 药丸 + 圆形按钮。
 *  返回 = 取消/放弃(替代原顶部关闭 X);保存 = 完成拍摄。 */
export function SideActions({ canSave, onBack, onSave }: Props) {
  return (
    <View style={styles.rail}>
      <TouchableOpacity
        testID="side-back-btn"
        style={styles.btn}
        onPress={onBack}
      >
        <Icon name="arrow-left" size={r(20)} color={DARK.white95} />
      </TouchableOpacity>
      {canSave && (
        <TouchableOpacity
          testID="side-save-btn"
          style={[styles.btn, styles.save]}
          onPress={onSave}
        >
          <Icon name="check" size={r(20)} color={DARK.white} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    gap: r(8),
    padding: r(6),
    paddingVertical: r(10),
    borderRadius: r(26),
    backgroundColor: DARK.black42,
    borderWidth: 1,
    borderColor: DARK.white08,
  },
  btn: {
    width: r(40),
    height: r(40),
    borderRadius: r(999),
    alignItems: 'center',
    justifyContent: 'center',
  },
  save: { backgroundColor: DARK.orange95 },
});
