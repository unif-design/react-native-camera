import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { r } from '@unif/react-native-design';
import type { Point } from '../utils';

type Props = { point: Point; onAnimationEnd: () => void };

const SIZE = r(80);

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
    // 对焦黄框:相机 UX 惯例(iOS / Android 系统相机统一用饱和黄高对比度),
    // 不走主题 token —— 任何主题下都需要在镜头预览(黑底为主)上一眼可见.
    borderColor: 'yellow',
    borderRadius: r(6),
  },
});
