import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon, r, type IconName } from '@unif/react-native-design';
import { DARK } from '../colors/dark';
import { VolumeIcon } from '../icons/VolumeIcon';

export type FlashMode = 'off' | 'on' | 'auto';
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
        <Icon
          name={aspectRatio === '4:3' ? 'aspect-4-3' : 'aspect-16-9'}
          size={r(20)}
          color={DARK.white95}
        />
      </TouchableOpacity>

      <View>
        <TouchableOpacity
          testID="flash-btn"
          style={[styles.btn, flash !== 'off' && styles.btnActive]}
          onPress={() => setFlashOpen((v) => !v)}
        >
          <Icon
            name={flashIcon[flash]}
            size={r(20)}
            color={flash !== 'off' ? DARK.white : DARK.white95}
          />
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
                  color={flash === o.key ? DARK.orange : DARK.white}
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
        <VolumeIcon
          on={sound}
          size={r(20)}
          color={sound ? DARK.white : DARK.white95}
        />
      </TouchableOpacity>
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
  btnActive: { backgroundColor: DARK.orange95 },
  dropdown: {
    position: 'absolute',
    left: r(52),
    top: 0,
    minWidth: r(130),
    padding: r(6),
    borderRadius: r(12),
    backgroundColor: 'rgba(28,28,30,0.94)',
  },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r(8),
    padding: r(10),
    borderRadius: r(8),
  },
  optTxt: { color: DARK.white, fontSize: r(14) },
  optTxtSel: { color: DARK.orange },
  tail: {
    position: 'absolute',
    left: r(-5),
    top: '50%',
    width: r(10),
    height: r(10),
    marginTop: r(-5),
    backgroundColor: 'rgba(28,28,30,0.94)',
    transform: [{ rotate: '45deg' }],
  },
});
