import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import {
  useEvent,
  useVideoPlayer,
  VideoView,
  type onPlaybackStateChangeData,
  type VideoPlayer as NativeVideoPlayer,
  type VideoPlayerStatus,
} from 'react-native-video';

type PlaybackState = {
  isPlaying: boolean;
  isBuffering: boolean;
};

const IDLE_PLAYBACK_STATE: PlaybackState = {
  isPlaying: false,
  isBuffering: false,
};

export function VideoPlayer({ uri }: { uri: string }) {
  const setupPlayer = useCallback((player: NativeVideoPlayer) => {
    player.loop = false;
  }, []);
  const player = useVideoPlayer({ uri }, setupPlayer);
  const [playback, setPlayback] = useState(IDLE_PLAYBACK_STATE);

  const resetPlayback = useCallback(() => {
    setPlayback(IDLE_PLAYBACK_STATE);
  }, []);
  const handlePlaybackStateChange = useCallback(
    ({ isPlaying, isBuffering }: onPlaybackStateChangeData) => {
      setPlayback({ isPlaying, isBuffering });
    },
    []
  );
  const handleBuffer = useCallback((isBuffering: boolean) => {
    setPlayback((current) =>
      current.isBuffering === isBuffering
        ? current
        : { ...current, isBuffering }
    );
  }, []);
  const handleStatusChange = useCallback(
    (status: VideoPlayerStatus) => {
      if (status === 'error') resetPlayback();
    },
    [resetPlayback]
  );

  useEvent(player, 'onPlaybackStateChange', handlePlaybackStateChange);
  useEvent(player, 'onBuffer', handleBuffer);
  useEvent(player, 'onEnd', resetPlayback);
  useEvent(player, 'onError', resetPlayback);
  useEvent(player, 'onStatusChange', handleStatusChange);

  // useVideoPlayer 会在 source 变化时替换 player；新实例不能继承旧视频的 UI 状态。
  useEffect(resetPlayback, [player, resetPlayback]);

  return (
    <Pressable
      testID="video-player"
      style={StyleSheet.absoluteFill}
      accessibilityRole="button"
      accessibilityLabel={playback.isPlaying ? '暂停视频' : '播放视频'}
      accessibilityState={{
        selected: playback.isPlaying,
        busy: playback.isBuffering,
      }}
      onPress={() => {
        if (playback.isPlaying) {
          player.pause();
        } else {
          player.play();
        }
      }}
    >
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        // contain 与照片 slide(SlideItem)/取景一致:完整画面、按比例留边、不裁切。
        resizeMode="contain"
      />
    </Pressable>
  );
}
