import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import type { Point } from '../utils';

type Props = { point: Point; onAnimationEnd: () => void };

const SIZE = 80;

export function FocusIndicator({ point, onAnimationEnd }: Props) {
  const scale = useRef(new Animated.Value(1.6)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => onAnimationEnd());
  }, [scale, opacity, onAnimationEnd]);

  return (
    <Animated.View
      style={[
        styles.box,
        {
          left: point.x - SIZE / 2,
          top: point.y - SIZE / 2,
          transform: [{ scale }],
          opacity,
        },
      ]}
      pointerEvents="none"
      testID="focus-indicator"
    />
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderWidth: 1.5,
    borderColor: 'yellow',
    borderRadius: 6,
  },
});
