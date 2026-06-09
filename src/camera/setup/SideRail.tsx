import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  Icon,
  r,
  fw,
  type as t,
  useColors,
  useThemedStyles,
  type ColorTokens,
  type IconName,
} from '@unif/react-native-design';
import type { FlashMode } from '../../utils';
import { VIEWFINDER } from '../colors/viewfinder';

// FlashMode 单一来源在 utils/interface.ts(公开 API 类型);这里 re-export 供 setup/camera barrel 透出。
export type { FlashMode };
export type AspectRatio = '4:3' | '16:9';

type Props = {
  flash: FlashMode;
  aspectRatio: AspectRatio;
  sound: boolean;
  onChangeFlash: (m: FlashMode) => void;
  onChangeAspectRatio: (r: AspectRatio) => void;
  onToggleSound: () => void;
};

const flashIcon: Record<FlashMode, IconName> = {
  off: 'flash-off',
  on: 'flash-on',
  auto: 'flash-auto',
};

const FLASH_OPTS: { key: FlashMode; label: string }[] = [
  { key: 'auto', label: '自动' },
  { key: 'on', label: '打开' },
  { key: 'off', label: '关闭' },
];

export function SideRail({
  flash,
  aspectRatio,
  sound,
  onChangeFlash,
  onChangeAspectRatio,
  onToggleSound,
}: Props) {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  const [flashOpen, setFlashOpen] = useState(false);
  return (
    <View style={styles.rail}>
      <TouchableOpacity
        testID="aspect-btn"
        style={styles.btn}
        onPress={() =>
          onChangeAspectRatio(aspectRatio === '4:3' ? '16:9' : '4:3')
        }
      >
        <Text style={styles.aspectTxt}>{aspectRatio}</Text>
      </TouchableOpacity>

      <View>
        <TouchableOpacity
          testID="flash-btn"
          style={[styles.btn, flash !== 'off' && styles.btnActive]}
          onPress={() => setFlashOpen((v) => !v)}
        >
          <Icon name={flashIcon[flash]} size={r(20)} color={c.foreground} />
        </TouchableOpacity>
        {flashOpen && (
          <View style={styles.dropdown}>
            {FLASH_OPTS.map((o) => (
              <TouchableOpacity
                key={o.key}
                testID={`flash-opt-${o.key}`}
                style={styles.opt}
                onPress={() => {
                  onChangeFlash(o.key);
                  setFlashOpen(false);
                }}
              >
                <Icon
                  name={flashIcon[o.key]}
                  size={r(18)}
                  color={flash === o.key ? c.primary : c.foreground}
                />
                <Text
                  style={[styles.optTxt, flash === o.key && styles.optTxtSel]}
                >
                  {o.label}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={styles.tail} testID="flash-tail" />
          </View>
        )}
      </View>

      <TouchableOpacity
        testID="sound-btn"
        style={[styles.btn, sound && styles.btnActive]}
        onPress={onToggleSound}
      >
        <Icon
          name={sound ? 'sound' : 'sound-off'}
          size={r(20)}
          color={c.foreground}
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
    btnActive: { backgroundColor: c.primary },
    aspectTxt: { color: c.foreground, fontSize: t.xs, fontWeight: fw.semi },
    // flash 下拉浮层:design surface(#1C1C1E == rgb(28,28,30),原为同 RGB 0.94 透)。
    dropdown: {
      position: 'absolute',
      left: r(52),
      top: 0,
      minWidth: r(130),
      padding: r(6),
      borderRadius: r(12),
      backgroundColor: c.surface,
    },
    opt: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: r(8),
      padding: r(10),
      borderRadius: r(8),
    },
    optTxt: { color: c.foreground, fontSize: t.sm },
    optTxtSel: { color: c.primary },
    tail: {
      position: 'absolute',
      left: r(-5),
      top: '50%',
      width: r(10),
      height: r(10),
      marginTop: r(-5),
      backgroundColor: c.surface,
      transform: [{ rotate: '45deg' }],
    },
  });
