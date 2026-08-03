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
import type { AspectRatio, FlashMode } from '../../utils';
import { makeRailStyles } from './railStyles';

// FlashMode / AspectRatio 单一来源在 utils/interface.ts(公开 API 类型);这里 re-export 供 setup/camera barrel 透出。
export type { AspectRatio, FlashMode };

type Props = {
  flash: FlashMode;
  aspectRatio: AspectRatio;
  sound: boolean;
  disabled?: boolean;
  onChangeFlash: (m: FlashMode) => void;
  onChangeAspectRatio: (r: AspectRatio) => void;
  onToggleSound: () => void;
};

const flashIcon: Record<FlashMode, IconName> = {
  off: 'flash-off',
  on: 'flash-on',
  auto: 'flash-auto',
};

const FLASH_LABEL: Record<FlashMode, string> = {
  off: '关闭',
  on: '开启',
  auto: '自动',
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
  disabled = false,
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
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`切换画幅比例，当前 ${aspectRatio}`}
        accessibilityState={{ disabled }}
      >
        <Text style={styles.aspectTxt}>{aspectRatio}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="flash-btn"
        style={[styles.btn, flash !== 'off' && styles.btnActive]}
        onPress={() => onChangeFlash(FLASH_NEXT[flash])}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`切换闪光灯，当前${FLASH_LABEL[flash]}`}
        accessibilityState={{ disabled }}
      >
        <Icon name={flashIcon[flash]} size={r(20)} color={c.foreground} />
      </TouchableOpacity>

      <TouchableOpacity
        testID="sound-btn"
        style={[styles.btn, sound && styles.btnActive]}
        onPress={onToggleSound}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={sound ? '关闭快门声音' : '开启快门声音'}
        accessibilityState={{ disabled }}
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
    ...makeRailStyles(c),
    btnActive: { backgroundColor: c.primary },
    aspectTxt: { color: c.foreground, fontSize: t.xs, fontWeight: fw.semi },
  });
