import { act, render, fireEvent } from '@testing-library/react-native';
import { VideoPlayer } from '../../components/VideoPlayer';

type PlayerMock = {
  play: jest.Mock;
  pause: jest.Mock;
  loop: boolean;
};

type VideoMock = {
  players: PlayerMock[];
  setupCallbacks: unknown[];
  listenerAdds: Array<{ event: string; callback: unknown }>;
  listenerRemoves: Array<{ event: string; callback: unknown }>;
  emit: (player: PlayerMock, event: string, ...args: unknown[]) => boolean;
  reset: () => void;
};

const videoMock = (
  jest.requireMock('react-native-video') as { __videoMock: VideoMock }
).__videoMock;

const latestPlayer = () => videoMock.players.at(-1)!;

beforeEach(() => {
  videoMock.reset();
  jest.clearAllMocks();
});

it('press 只委托 native play/pause，不乐观改变播放状态', () => {
  const { getByRole } = render(<VideoPlayer uri="file:///v.mp4" />);
  const player = latestPlayer();
  const control = getByRole('button', {
    name: '播放视频',
    selected: false,
  });

  fireEvent.press(control);
  expect(player.play).toHaveBeenCalledTimes(1);
  expect(
    getByRole('button', { name: '播放视频', selected: false })
  ).toBeTruthy();

  act(() => {
    videoMock.emit(player, 'onPlaybackStateChange', {
      isPlaying: true,
      isBuffering: false,
    });
  });
  const pauseControl = getByRole('button', {
    name: '暂停视频',
    selected: true,
  });
  fireEvent.press(pauseControl);
  expect(player.pause).toHaveBeenCalledTimes(1);
  expect(
    getByRole('button', { name: '暂停视频', selected: true })
  ).toBeTruthy();
});

it('native playback/buffering event 是 accessibility state 的唯一真值', () => {
  const { getByRole } = render(<VideoPlayer uri="file:///v.mp4" />);
  const player = latestPlayer();

  act(() => {
    videoMock.emit(player, 'onPlaybackStateChange', {
      isPlaying: true,
      isBuffering: true,
    });
  });

  expect(
    getByRole('button', {
      name: '暂停视频',
      selected: true,
      busy: true,
    })
  ).toBeTruthy();
});

it('独立 onBuffer event 更新 busy 且保留 native playing 状态', () => {
  const { getByRole } = render(<VideoPlayer uri="file:///v.mp4" />);
  const player = latestPlayer();

  act(() => {
    videoMock.emit(player, 'onPlaybackStateChange', {
      isPlaying: true,
      isBuffering: false,
    });
    videoMock.emit(player, 'onBuffer', true);
  });
  expect(
    getByRole('button', {
      name: '暂停视频',
      selected: true,
      busy: true,
    })
  ).toBeTruthy();

  act(() => {
    videoMock.emit(player, 'onBuffer', false);
  });
  expect(
    getByRole('button', {
      name: '暂停视频',
      selected: true,
      busy: false,
    })
  ).toBeTruthy();
});

it('外部 pause、播放结束和 JS error 都复位 UI', () => {
  const { getByRole } = render(<VideoPlayer uri="file:///v.mp4" />);
  const player = latestPlayer();
  const play = () =>
    act(() => {
      videoMock.emit(player, 'onPlaybackStateChange', {
        isPlaying: true,
        isBuffering: false,
      });
    });

  play();
  act(() => {
    videoMock.emit(player, 'onPlaybackStateChange', {
      isPlaying: false,
      isBuffering: false,
    });
  });
  expect(
    getByRole('button', { name: '播放视频', selected: false })
  ).toBeTruthy();

  play();
  act(() => {
    videoMock.emit(player, 'onEnd');
  });
  expect(
    getByRole('button', { name: '播放视频', selected: false })
  ).toBeTruthy();

  play();
  act(() => {
    videoMock.emit(player, 'onError', new Error('decode failed'));
  });
  expect(
    getByRole('button', {
      name: '播放视频',
      selected: false,
      busy: false,
    })
  ).toBeTruthy();
});

it("native onStatusChange('error') 复位 UI", () => {
  const { getByRole } = render(<VideoPlayer uri="file:///v.mp4" />);
  const player = latestPlayer();

  act(() => {
    videoMock.emit(player, 'onPlaybackStateChange', {
      isPlaying: true,
      isBuffering: true,
    });
    videoMock.emit(player, 'onStatusChange', 'error');
  });

  expect(
    getByRole('button', {
      name: '播放视频',
      selected: false,
      busy: false,
    })
  ).toBeTruthy();
});

it('uri 改变由 useVideoPlayer 创建新 player 并重置旧 UI state', () => {
  const { getByRole, rerender } = render(<VideoPlayer uri="file:///a.mp4" />);
  const firstPlayer = latestPlayer();
  act(() => {
    videoMock.emit(firstPlayer, 'onPlaybackStateChange', {
      isPlaying: true,
      isBuffering: false,
    });
  });
  expect(
    getByRole('button', { name: '暂停视频', selected: true })
  ).toBeTruthy();

  rerender(<VideoPlayer uri="file:///b.mp4" />);

  expect(latestPlayer()).not.toBe(firstPlayer);
  expect(
    getByRole('button', { name: '播放视频', selected: false })
  ).toBeTruthy();
});

it('same uri 无关 rerender 保持 setup callback identity', () => {
  const { rerender } = render(<VideoPlayer uri="file:///v.mp4" />);
  const firstSetup = videoMock.setupCallbacks[0];

  rerender(<VideoPlayer uri="file:///v.mp4" />);

  expect(videoMock.setupCallbacks).toHaveLength(2);
  expect(videoMock.setupCallbacks[1]).toBe(firstSetup);
});

it('same uri 无关 rerender 不退订重订 native listeners', () => {
  const { rerender } = render(<VideoPlayer uri="file:///v.mp4" />);
  expect(videoMock.listenerAdds.map(({ event }) => event)).toEqual([
    'onPlaybackStateChange',
    'onBuffer',
    'onEnd',
    'onError',
    'onStatusChange',
  ]);

  rerender(<VideoPlayer uri="file:///v.mp4" />);

  expect(videoMock.listenerAdds).toHaveLength(5);
  expect(videoMock.listenerRemoves).toHaveLength(0);
});

it('播放到结尾后不自动 loop', () => {
  render(<VideoPlayer uri="file:///v.mp4" />);
  expect(latestPlayer().loop).toBe(false);
});
