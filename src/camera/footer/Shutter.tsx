import { useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { r } from '@unif/react-native-design';
import { DARK } from '../colors/dark';

type Props = {
  mode: 'single' | 'continuous' | 'video';
  recording: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export function Shutter({ mode, recording, disabled, onPress }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.timing(scale, {
      toValue: v,
      duration: 100,
      useNativeDriver: true,
    }).start();
  const isVideo = mode === 'video';
  const inner = recording
    ? styles.innerRecording
    : isVideo
      ? styles.innerVideo
      : styles.innerPhoto;
  return (
    <Pressable
      testID="shutter-btn"
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => to(0.94)}
      onPressOut={() => to(1)}
    >
      <Animated.View style={[styles.ring, { transform: [{ scale }] }]}>
        <Animated.View style={[styles.innerBase, inner]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: r(72),
    height: r(72),
    borderRadius: r(36),
    borderWidth: r(3),
    borderColor: DARK.white95,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerBase: {},
  innerPhoto: {
    width: r(58),
    height: r(58),
    borderRadius: r(29),
    backgroundColor: DARK.white,
  },
  innerVideo: {
    width: r(58),
    height: r(58),
    borderRadius: r(29),
    backgroundColor: DARK.recRed,
  },
  innerRecording: {
    width: r(24),
    height: r(24),
    borderRadius: r(4),
    backgroundColor: DARK.recRed,
  },
});
