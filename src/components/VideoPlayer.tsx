import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'react-native-video';

export function VideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
  });
  const [playing, setPlaying] = useState(false);
  return (
    <Pressable
      testID="video-player"
      style={StyleSheet.absoluteFill}
      onPress={() => {
        if (playing) {
          player.pause();
        } else {
          player.play();
        }
        setPlaying((p) => !p);
      }}
    >
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        // cover 与照片 slide(SlideItem)/取景一致:满宽铺满、按比例裁掉上下超出。
        resizeMode="cover"
      />
    </Pressable>
  );
}
