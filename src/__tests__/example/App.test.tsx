import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import type { CameraApi, CameraResult } from '@unif/react-native-camera';
import { useCamera } from '@unif/react-native-camera';

import App from '../../../example/src/App';

// 根 Jest renderer 与 example workspace 必须共享同一 React hook dispatcher。
jest.mock('../../../example/node_modules/react', () =>
  jest.requireActual('react')
);

jest.mock(
  '@unif/react-native-design',
  () => require('../__helpers__/exampleDesignMock'),
  { virtual: true }
);

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GestureHandlerRootView: ({ children }: { children?: unknown }) =>
      React.createElement(View, null, children),
  };
});

jest.mock('../../../example/node_modules/react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GestureHandlerRootView: ({ children }: { children?: unknown }) =>
      React.createElement(View, null, children),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const passthrough = ({ children }: { children?: unknown }) =>
    React.createElement(View, null, children);
  return {
    SafeAreaProvider: passthrough,
    SafeAreaView: passthrough,
  };
});

jest.mock(
  '../../../example/node_modules/react-native-safe-area-context',
  () => {
    const React = require('react');
    const { View } = require('react-native');
    const passthrough = ({ children }: { children?: unknown }) =>
      React.createElement(View, null, children);
    return {
      SafeAreaProvider: passthrough,
      SafeAreaView: passthrough,
    };
  }
);

jest.mock('@unif/react-native-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  const officialMock = require('@unif/react-native-camera/mock');

  return {
    ...officialMock,
    useCamera: jest.fn(() => {
      const [api] = officialMock.useCamera();
      return [
        api,
        React.createElement(View, {
          testID: 'visible-camera-holder',
        }),
      ];
    }),
  };
});

const photoResult: CameraResult = {
  code: 200,
  data: [
    {
      id: 'photo-1',
      cameraType: 'back',
      cameraMode: 'single',
      path: '/tmp/photo-1.jpg',
      uri: 'file:///tmp/photo-1.jpg',
      width: 4032,
      height: 3024,
      mime: 'image/jpeg',
      mode: 'single',
      isRemake: false,
    },
  ],
  message: 'success',
};

const videoResult: CameraResult = {
  code: 200,
  data: [
    {
      id: 'video-1',
      cameraType: 'front',
      cameraMode: 'video',
      path: '/tmp/video-1.mp4',
      uri: 'file:///tmp/video-1.mp4',
      width: 3840,
      height: 2160,
      mime: 'video/mp4',
      mode: 'video',
      isRemake: false,
      duration: 12.5,
    },
  ],
  message: 'success',
};

function currentApi(): CameraApi {
  const firstResult = jest.mocked(useCamera).mock.results[0]?.value as
    | [CameraApi, unknown]
    | undefined;
  if (!firstResult) {
    throw new Error('App 尚未调用 useCamera');
  }
  return firstResult[0];
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('全 App 只调用一次公开 useCamera，holder 跨导航固定且唯一', () => {
  render(<App />);

  expect(useCamera).toHaveBeenCalledTimes(1);
  expect(screen.getAllByTestId('visible-camera-holder')).toHaveLength(1);

  fireEvent.press(screen.getByRole('button', { name: '水印存证' }));
  expect(screen.getByText('水印只作用于 JPEG')).toBeOnTheScreen();
  expect(useCamera).toHaveBeenCalledTimes(1);
  expect(screen.getAllByTestId('visible-camera-holder')).toHaveLength(1);

  fireEvent.press(screen.getByRole('button', { name: '返回' }));
  fireEvent.press(screen.getByRole('button', { name: '质量实验室' }));
  expect(screen.getByText('质量参数不等于分辨率设置')).toBeOnTheScreen();
  expect(useCamera).toHaveBeenCalledTimes(1);
  expect(screen.getAllByTestId('visible-camera-holder')).toHaveLength(1);
});

it('成功照片历史展示完整 metadata、可选路径与临时目录警告，并可清空', async () => {
  render(<App />);
  jest.mocked(currentApi().open).mockResolvedValueOnce(photoResult);

  fireEvent.press(screen.getByRole('button', { name: '基础拍摄' }));
  fireEvent.press(screen.getByRole('button', { name: '打开相机' }));
  await waitFor(() => {
    expect(screen.getByText('拍摄成功')).toBeOnTheScreen();
  });
  fireEvent.press(screen.getByRole('button', { name: '返回' }));

  expect(screen.getByTestId('media-image-photo-1')).toBeOnTheScreen();
  expect(screen.getByText('photo-1')).toBeOnTheScreen();
  expect(screen.getByText('image/jpeg')).toBeOnTheScreen();
  expect(screen.getByText('single · back')).toBeOnTheScreen();
  expect(screen.getByText('4032 × 3024')).toBeOnTheScreen();
  expect(screen.getByText('/tmp/photo-1.jpg')).toHaveProp('selectable', true);
  expect(screen.getByText('file:///tmp/photo-1.jpg')).toHaveProp(
    'selectable',
    true
  );
  expect(screen.getByText(/返回媒体仍位于临时目录/)).toBeOnTheScreen();
  expect(screen.getByText(/"code": 200/)).toHaveProp('selectable', true);

  fireEvent.press(screen.getByRole('button', { name: '清空历史' }));
  expect(screen.getByText('暂无本进程拍摄结果。')).toBeOnTheScreen();
  expect(screen.queryByText('photo-1')).not.toBeOnTheScreen();
});

it('成功视频只展示 Design Icon 与 metadata，不渲染 Image 或播放器', async () => {
  render(<App />);
  jest.mocked(currentApi().open).mockResolvedValueOnce(videoResult);

  fireEvent.press(screen.getByRole('button', { name: '基础拍摄' }));
  fireEvent.press(screen.getByRole('tab', { name: '录像' }));
  fireEvent.press(screen.getByRole('button', { name: '打开相机' }));
  await waitFor(() => {
    expect(screen.getByText('拍摄成功')).toBeOnTheScreen();
  });
  fireEvent.press(screen.getByRole('button', { name: '返回' }));

  expect(screen.getByTestId('media-video-icon-video-1')).toBeOnTheScreen();
  expect(screen.queryByTestId('media-image-video-1')).not.toBeOnTheScreen();
  expect(screen.getByText('video/mp4')).toBeOnTheScreen();
  expect(screen.getByText('video · front')).toBeOnTheScreen();
  expect(screen.getByText('时长 12.5 秒')).toBeOnTheScreen();
  expect(screen.getByText('示例不内置视频播放器')).toBeOnTheScreen();
});

it('code 0 使用中性取消语义，503 保留码措辞可诊断', async () => {
  render(<App />);
  const api = currentApi();
  jest
    .mocked(api.open)
    .mockResolvedValueOnce({ code: 0, data: [], message: 'cancelled' })
    .mockResolvedValueOnce({
      code: 503,
      data: [],
      message: 'reserved_video_failure',
    });

  fireEvent.press(screen.getByRole('button', { name: '基础拍摄' }));
  fireEvent.press(screen.getByRole('button', { name: '打开相机' }));
  await waitFor(() => {
    expect(screen.getByTestId('tag-neutral')).toHaveTextContent('已取消');
  });
  expect(screen.queryByTestId('tag-error')).not.toBeOnTheScreen();

  fireEvent.press(screen.getByRole('button', { name: '打开相机' }));
  await waitFor(() => {
    expect(
      screen.getByText('录像失败（保留码，当前实现不主动触发）')
    ).toBeOnTheScreen();
  });
});
