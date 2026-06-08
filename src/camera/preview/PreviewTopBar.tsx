import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { r } from '@unif/react-native-design';
import type { CustomPhotoFile, CameraModeName } from '../../utils';
import { distinctTypes, filesOfType } from './groupTypes';
import { DARK } from '../colors/dark';

const LABEL: Record<CameraModeName, string> = {
  continuous: '连拍',
  single: '单拍',
  video: '视频',
};

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
  // 顶部安全区(刘海 / 状态栏)+ 基础 14
  const rootStyle = [styles.root, { paddingTop: insets.top + r(14) }];
  if (variant === 'confirm') {
    return (
      <View style={rootStyle}>
        <Text style={styles.label}>{LABEL[activeType]}</Text>
      </View>
    );
  }
  const types = distinctTypes(files);
  return (
    <View style={rootStyle}>
      {types.length > 1 && (
        <View style={styles.tabs}>
          {types.map((t) => {
            const sel = t === activeType;
            return (
              <TouchableOpacity
                key={t}
                testID={`type-tab-${t}`}
                onPress={() => onSelectType(t)}
                style={[styles.tab, sel && styles.tabSel]}
              >
                <Text style={[styles.tabTxt, sel && styles.tabTxtSel]}>
                  {LABEL[t]}
                  {filesOfType(files, t).length}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

// 预览顶部走相机黑底(与整屏统一),文字 / tab 用 DARK;paddingTop 由组件按安全区给。
const styles = StyleSheet.create({
  root: {
    minHeight: r(46),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: r(10),
    paddingHorizontal: r(14),
  },
  label: { color: DARK.white, fontSize: r(14), fontWeight: '500' },
  tabs: {
    flexDirection: 'row',
    gap: r(4),
    padding: r(4),
    borderRadius: r(999),
    backgroundColor: DARK.white12,
  },
  tab: {
    paddingVertical: r(7),
    paddingHorizontal: r(16),
    borderRadius: r(999),
  },
  tabSel: { backgroundColor: '#EB6E00' },
  tabTxt: { color: DARK.white, fontSize: r(13), fontWeight: '600' },
  tabTxtSel: { color: '#fff' },
});
