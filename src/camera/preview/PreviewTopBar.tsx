import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  r,
  fw,
  type as t,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';
import type { CustomPhotoFile, CameraModeName } from '../../utils';
import { distinctTypes, filesOfType, MODE_LABEL } from './groupTypes';

type Props = {
  variant: 'confirm' | 'gallery';
  files: CustomPhotoFile[];
  activeType: CameraModeName;
  onSelectType: (t: CameraModeName) => void;
};

export function PreviewTopBar({
  variant,
  files,
  activeType,
  onSelectType,
}: Props) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);
  // 顶部安全区(刘海 / 状态栏)+ 基础 14
  const rootStyle = [styles.root, { paddingTop: insets.top + r(14) }];
  // 未保留(confirm,单张确认)不显示类型分类 —— 顶部仅保留空容器(安全区 + minHeight 占位),布局不塌。
  if (variant === 'confirm') {
    return <View style={rootStyle} />;
  }
  // 保留(gallery,累积多张)按类型分 tab —— 只要有类型就显示,单类型也显示其 tab。
  const types = distinctTypes(files);
  return (
    <View style={rootStyle}>
      {types.length > 0 && (
        <View style={styles.tabs}>
          {types.map((ty) => {
            const sel = ty === activeType;
            return (
              <TouchableOpacity
                key={ty}
                testID={`type-tab-${ty}`}
                onPress={() => onSelectType(ty)}
                style={[styles.tab, sel && styles.tabSel]}
              >
                <Text style={[styles.tabTxt, sel && styles.tabTxtSel]}>
                  {MODE_LABEL[ty]}
                  {filesOfType(files, ty).length}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

// 预览顶部走相机黑底(与整屏统一),文字 / tab 用 design token;paddingTop 由组件按安全区给。
const makeStyles = (c: ColorTokens) =>
  StyleSheet.create({
    root: {
      minHeight: r(46),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: r(10),
      paddingHorizontal: r(14),
    },
    tabs: {
      flexDirection: 'row',
      gap: r(4),
      padding: r(4),
      borderRadius: r(999),
      backgroundColor: c.glassPillBorder,
    },
    tab: {
      paddingVertical: r(7),
      paddingHorizontal: r(16),
      borderRadius: r(999),
    },
    tabSel: { backgroundColor: c.primary },
    tabTxt: { color: c.foreground, fontSize: t.xs, fontWeight: fw.semi },
    tabTxtSel: { color: c.foreground },
  });
