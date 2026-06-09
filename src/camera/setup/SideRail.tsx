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

// 闪光原地轮换:点一下 auto → on → off → auto(与画幅 4:3↔16:9 文字按钮一致的「点击切换」交互)。
// 早期弹出层(dropdown + 三选项 + tail 三角)已去除:它会盖住取景、且与同列其它按钮交互不一致。
const FLASH_NEXT: Record<FlashMode, FlashMode> = {
  auto: 'on',
  on: 'off',
  off: 'auto',
};

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

      <TouchableOpacity
        testID="flash-btn"
        style={[styles.btn, flash !== 'off' && styles.btnActive]}
        onPress={() => onChangeFlash(FLASH_NEXT[flash])}
      >
        <Icon name={flashIcon[flash]} size={r(20)} color={c.foreground} />
      </TouchableOpacity>

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
  });
