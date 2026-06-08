import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useColors } from '@unif/react-native-design';

type Props = { trigger: number };

// 拍照闪光:全屏白 overlay。`trigger`(nonce)变化时闪一下 —— opacity 0→0.85(60ms 进)→0(180ms 出)。
// trigger===0 视为初始态,不播(避免挂载即闪)。
export function CaptureFlash({ trigger }: Props) {
  const c = useColors();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger === 0) {
      return;
    }
    const anim = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 0.85,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [trigger, opacity]);

  return (
    <Animated.View
      testID="capture-flash"
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: c.foreground, opacity },
      ]}
    />
  );
}
