import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Video from 'react-native-video';

export function VideoPlayer({ uri }: { uri: string }) {
  const [paused, setPaused] = useState(true);
  return (
    <Pressable
      testID="video-player"
      style={StyleSheet.absoluteFill}
      onPress={() => setPaused((p) => !p)}
    >
      <Video
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode="contain"
        paused={paused}
        repeat
      />
    </Pressable>
  );
}
