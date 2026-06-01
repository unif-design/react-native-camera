import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { r, useThemedStyles } from '@unif/react-native-design';
import type { ColorTokens } from '@unif/react-native-design';
import type { CustomPhotoFile, CameraModeName } from '../../utils';
import { distinctTypes, filesOfType } from './groupTypes';

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
  const styles = useThemedStyles(makeStyles);
  if (variant === 'confirm') {
    return (
      <View style={styles.root}>
        <Text style={styles.label}>{LABEL[activeType]}</Text>
      </View>
    );
  }
  const types = distinctTypes(files);
  const total = files.length;
  return (
    <View style={styles.root}>
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
      <Text style={styles.total}>共 {total} 张</Text>
    </View>
  );
}

const makeStyles = (c: ColorTokens) =>
  StyleSheet.create({
    root: {
      minHeight: r(46),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: r(10),
      paddingHorizontal: r(14),
      paddingTop: r(14),
    },
    label: { color: c.foreground, fontSize: r(14), fontWeight: '500' },
    tabs: {
      flexDirection: 'row',
      gap: r(4),
      padding: r(4),
      borderRadius: r(999),
      backgroundColor: c.surface,
    },
    tab: {
      paddingVertical: r(7),
      paddingHorizontal: r(16),
      borderRadius: r(999),
    },
    tabSel: { backgroundColor: '#EB6E00' },
    tabTxt: { color: c.foreground, fontSize: r(13), fontWeight: '600' },
    tabTxtSel: { color: '#fff' },
    total: { color: c.foreground, fontSize: r(13), opacity: 0.7 },
  });
