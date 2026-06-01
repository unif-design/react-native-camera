import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { r } from '@unif/react-native-design';
import { DARK } from '../colors/dark';

export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function RecordingTimer({ seconds }: { seconds: number }) {
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(blink, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [blink]);
  return (
    <View style={styles.pill} testID="recording-timer">
      <Animated.View style={[styles.dot, { opacity: blink }]} />
      <Text style={styles.text}>{formatDuration(seconds)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r(8),
    paddingVertical: r(6),
    paddingHorizontal: r(14),
    borderRadius: r(999),
    backgroundColor: 'rgba(255,59,48,0.18)',
  },
  dot: {
    width: r(8),
    height: r(8),
    borderRadius: r(4),
    backgroundColor: DARK.recRed,
  },
  text: { color: DARK.white, fontSize: r(13), fontVariant: ['tabular-nums'] },
});
