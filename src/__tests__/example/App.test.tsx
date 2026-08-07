import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import type { CameraApi, CameraResult } from '@unif/react-native-camera';
import { useCamera } from '@unif/react-native-camera';

import App from '../../../example/src/App';

// App 自带 GestureHandlerRootView / ThemeProvider / SafeAreaProvider 三层真实装配,
// RNGH 与 safe-area 的接线由 `@unif/react-native-design/jest-setup` 统一提供,
// 这里只替换相机 holder —— 用例断言的是 showcase 路由与结果呈现,不是原生相机。
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

type HardwareBackHandler = Parameters<typeof BackHandler.addEventListener>[1];

const hardwareBackEvent: Parameters<HardwareBackHandler>[0] = {
  type: 'hardwareBackPress',
  timeStamp: 1,
};

let hardwareBackHandler: HardwareBackHandler | undefined;
let removeHardwareBackHandler: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  removeHardwareBackHandler = jest.fn();
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((eventName, handler) => {
      if (eventName === 'hardwareBackPress') {
        hardwareBackHandler = handler;
      }
      return { remove: removeHardwareBackHandler };
    });
});

afterEach(() => {
  hardwareBackHandler = undefined;
  jest.restoreAllMocks();
});

it('Android hardware back 在 Home 不消费事件', () => {
  render(<App />);

  expect(hardwareBackHandler).toBeDefined();
  expect(hardwareBackHandler?.(hardwareBackEvent)).toBe(false);
  expect(screen.getByText('选择场景')).toBeOnTheScreen();
});

it('Android hardware back 在子 route 消费事件并返回 Home', () => {
  render(<App />);
  fireEvent.press(screen.getByRole('button', { name: /基础拍摄/ }));

  expect(hardwareBackHandler).toBeDefined();
  let consumed: boolean | null | undefined;
  act(() => {
    consumed = hardwareBackHandler?.(hardwareBackEvent);
  });
  expect(consumed).toBe(true);
  expect(screen.getByText('选择场景')).toBeOnTheScreen();
});

it('Showcase navigator unmount 时取消 Android hardware back 订阅', () => {
  const { unmount } = render(<App />);

  expect(BackHandler.addEventListener).toHaveBeenCalledWith(
    'hardwareBackPress',
    expect.any(Function)
  );
  unmount();

  expect(removeHardwareBackHandler).toHaveBeenCalledTimes(1);
});

it('四个场景往返时始终只调用一次公开 useCamera，并只渲染一个可见 holder', () => {
  render(<App />);

  expect(useCamera).toHaveBeenCalledTimes(1);
  expect(screen.getAllByTestId('visible-camera-holder')).toHaveLength(1);

  const scenarios = [
    {
      entryName: /基础拍摄/,
      marker: '一次只传入一个 cameraMode，便于复制最小公开配置。',
    },
    {
      entryName: /多模式/,
      marker:
        '一次打开同时提供单拍、连拍和录像，在相机内切换并比较文件保留语义。',
    },
    {
      entryName: /水印存证/,
      marker: '水印只作用于 JPEG',
    },
    {
      entryName: /质量实验室/,
      marker: '质量参数不等于分辨率设置',
    },
  ] as const;

  for (const scenario of scenarios) {
    fireEvent.press(screen.getByRole('button', { name: scenario.entryName }));
    expect(screen.getByText(scenario.marker)).toBeOnTheScreen();
    expect(useCamera).toHaveBeenCalledTimes(1);
    expect(screen.getAllByTestId('visible-camera-holder')).toHaveLength(1);

    fireEvent.press(screen.getByRole('button', { name: '返回' }));
    expect(screen.getByText('选择场景')).toBeOnTheScreen();
    expect(useCamera).toHaveBeenCalledTimes(1);
    expect(screen.getAllByTestId('visible-camera-holder')).toHaveLength(1);
  }
});

it('水印页返回首页后重进仍保留标题、地点、备注与位置', () => {
  render(<App />);

  fireEvent.press(screen.getByRole('button', { name: /水印存证/ }));
  fireEvent.changeText(screen.getByLabelText('记录标题'), '设备巡检记录');
  fireEvent.changeText(screen.getByLabelText('手工地点'), 'A 区东门');
  fireEvent.changeText(screen.getByLabelText('备注'), '门锁完好');
  fireEvent.press(screen.getByRole('tab', { name: '右下' }));

  fireEvent.press(screen.getByRole('button', { name: '返回' }));
  fireEvent.press(screen.getByRole('button', { name: /水印存证/ }));

  expect(screen.getByLabelText('记录标题')).toHaveProp('value', '设备巡检记录');
  expect(screen.getByLabelText('手工地点')).toHaveProp('value', 'A 区东门');
  expect(screen.getByLabelText('备注')).toHaveProp('value', '门锁完好');
  expect(screen.getByRole('tab', { name: '右下' })).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ selected: true })
  );
});

it('质量页返回首页后重进仍保留实验类型、优先级、HDR 与码率', () => {
  render(<App />);

  fireEvent.press(screen.getByRole('button', { name: /质量实验室/ }));
  fireEvent.press(screen.getByRole('tab', { name: '质量优先' }));
  fireEvent.press(screen.getByRole('tab', { name: '显式控制' }));
  fireEvent.press(screen.getByRole('switch', { name: '照片 HDR' }));
  fireEvent.press(screen.getByRole('tab', { name: '录像实验' }));
  fireEvent.press(screen.getByRole('tab', { name: '显式码率' }));
  fireEvent.changeText(screen.getByLabelText('视频码率（bps）'), '18000000');

  fireEvent.press(screen.getByRole('button', { name: '返回' }));
  fireEvent.press(screen.getByRole('button', { name: /质量实验室/ }));

  expect(screen.getByRole('tab', { name: '录像实验' })).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ selected: true })
  );
  expect(screen.getByRole('tab', { name: '显式码率' })).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ selected: true })
  );
  expect(screen.getByLabelText('视频码率（bps）')).toHaveProp(
    'value',
    '18000000'
  );

  fireEvent.press(screen.getByRole('tab', { name: '照片实验' }));
  expect(screen.getByRole('tab', { name: '质量优先' })).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ selected: true })
  );
  expect(screen.getByRole('tab', { name: '显式控制' })).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ selected: true })
  );
  expect(screen.getByRole('switch', { name: '照片 HDR' })).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ checked: true, disabled: false })
  );
});

it('基础与多模式页返回首页后重进仍保留场景选择', () => {
  render(<App />);

  fireEvent.press(screen.getByRole('button', { name: /基础拍摄/ }));
  fireEvent.press(screen.getByRole('tab', { name: '录像' }));
  fireEvent.press(screen.getByRole('tab', { name: '前摄' }));
  fireEvent.press(screen.getByRole('tab', { name: '开启' }));
  fireEvent.press(screen.getByRole('button', { name: '返回' }));
  fireEvent.press(screen.getByRole('button', { name: /基础拍摄/ }));

  for (const selection of ['录像', '前摄', '开启']) {
    expect(screen.getByRole('tab', { name: selection })).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true })
    );
  }

  fireEvent.press(screen.getByRole('button', { name: '返回' }));
  fireEvent.press(screen.getByRole('button', { name: /多模式/ }));
  fireEvent.press(screen.getByRole('tab', { name: '跨模式保留' }));
  fireEvent.press(screen.getByRole('button', { name: '返回' }));
  fireEvent.press(screen.getByRole('button', { name: /多模式/ }));

  expect(screen.getByRole('tab', { name: '跨模式保留' })).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ selected: true })
  );
});

it('成功照片历史展示完整 metadata、可选路径与临时目录警告，并可清空', async () => {
  render(<App />);
  jest.mocked(currentApi().open).mockResolvedValueOnce(photoResult);

  fireEvent.press(screen.getByRole('button', { name: /基础拍摄/ }));
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

it('临时照片 URI 失效时切换为明确的 Design Empty 空态', async () => {
  render(<App />);
  jest.mocked(currentApi().open).mockResolvedValueOnce(photoResult);

  fireEvent.press(screen.getByRole('button', { name: /基础拍摄/ }));
  fireEvent.press(screen.getByRole('button', { name: '打开相机' }));
  await waitFor(() => {
    expect(screen.getByTestId('media-image-photo-1')).toBeOnTheScreen();
  });

  fireEvent(screen.getByTestId('media-image-photo-1'), 'error');

  expect(screen.queryByTestId('media-image-photo-1')).not.toBeOnTheScreen();
  expect(screen.getByTestId('media-empty-photo-1')).toBeOnTheScreen();
  expect(screen.getByText('临时照片预览已失效')).toBeOnTheScreen();
  expect(
    screen.getByText('文件可能已被系统清理；生产业务应及时复制或上传。')
  ).toBeOnTheScreen();
});

it('历史仅默认展开最新记录，旧记录按需展开和收起媒体与 JSON', async () => {
  render(<App />);
  jest
    .mocked(currentApi().open)
    .mockResolvedValueOnce(photoResult)
    .mockResolvedValueOnce({
      ...photoResult,
      data: [
        {
          ...photoResult.data[0]!,
          id: 'photo-2',
          path: '/tmp/photo-2.jpg',
          uri: 'file:///tmp/photo-2.jpg',
        },
      ],
    });

  fireEvent.press(screen.getByRole('button', { name: /基础拍摄/ }));
  fireEvent.press(screen.getByRole('button', { name: '打开相机' }));
  await waitFor(() => {
    expect(screen.getByText('photo-1')).toBeOnTheScreen();
  });
  fireEvent.press(screen.getByRole('button', { name: '打开相机' }));
  await waitFor(() => {
    expect(screen.getByText('photo-2')).toBeOnTheScreen();
  });
  fireEvent.press(screen.getByRole('button', { name: '返回' }));

  expect(screen.getByText('photo-2')).toBeOnTheScreen();
  expect(screen.queryByText('photo-1')).not.toBeOnTheScreen();

  fireEvent.press(screen.getByRole('button', { name: '展开详情' }));
  expect(screen.getByText('photo-1')).toBeOnTheScreen();
  expect(screen.getAllByText(/"code": 200/)).toHaveLength(2);

  fireEvent.press(screen.getByRole('button', { name: '收起详情' }));
  expect(screen.queryByText('photo-1')).not.toBeOnTheScreen();
  expect(screen.getAllByText(/"code": 200/)).toHaveLength(1);
});

it('成功视频只展示 Design Icon 与 metadata，不渲染 Image 或播放器', async () => {
  render(<App />);
  jest.mocked(currentApi().open).mockResolvedValueOnce(videoResult);

  fireEvent.press(screen.getByRole('button', { name: /基础拍摄/ }));
  fireEvent.press(screen.getByRole('tab', { name: '录像' }));
  fireEvent.press(screen.getByRole('button', { name: '打开相机' }));
  await waitFor(() => {
    expect(screen.getByText('拍摄成功')).toBeOnTheScreen();
  });
  fireEvent.press(screen.getByRole('button', { name: '返回' }));

  // 真 Design Icon 是装饰件,整棵 a11y 子树隐藏(accessibilityElementsHidden +
  // importantForAccessibility="no-hide-descendants"),默认查询看不到它 —— 这正是
  // 期望的无障碍行为,故按 testID 查时显式带上隐藏元素。
  expect(
    screen.getByTestId('media-video-icon-video-1', {
      includeHiddenElements: true,
    })
  ).toBeOnTheScreen();
  expect(
    screen.queryByTestId('media-image-video-1', { includeHiddenElements: true })
  ).not.toBeOnTheScreen();
  expect(screen.getByText('video/mp4')).toBeOnTheScreen();
  expect(screen.getByText('video · front')).toBeOnTheScreen();
  expect(screen.getByText('时长 12.5 秒')).toBeOnTheScreen();
  expect(screen.getByText('示例不内置视频播放器')).toBeOnTheScreen();
});

it.each(['基础拍摄', '多模式', '水印存证', '质量实验室'])(
  '%s 的 api.open unexpected reject 展示可访问的 runtime diagnostic 且不伪造结果码',
  async (entryName) => {
    render(<App />);
    jest
      .mocked(currentApi().open)
      .mockRejectedValueOnce(new Error('native bridge unavailable'));

    fireEvent.press(
      screen.getByRole('button', { name: new RegExp(entryName) })
    );
    if (entryName === '水印存证') {
      fireEvent.changeText(screen.getByLabelText('记录标题'), '巡检记录');
    }
    fireEvent.press(screen.getByRole('button', { name: '打开相机' }));

    await waitFor(() => {
      expect(
        screen.getByRole('alert', {
          name: /相机运行异常.*native bridge unavailable/,
        })
      ).toBeOnTheScreen();
    });
    expect(screen.getByText('native bridge unavailable')).toBeOnTheScreen();
    expect(screen.queryByText(/结果码 500/)).not.toBeOnTheScreen();
  }
);

it('code 403 展示 message、diagnostic、状态 Icon 与系统设置恢复指引', async () => {
  render(<App />);
  jest.mocked(currentApi().open).mockResolvedValueOnce({
    code: 403,
    data: [],
    message: 'permission_denied',
  });

  fireEvent.press(screen.getByRole('button', { name: /基础拍摄/ }));
  fireEvent.press(screen.getByRole('button', { name: '打开相机' }));

  await waitFor(() => {
    expect(screen.getByText('相机权限被拒绝')).toBeOnTheScreen();
  });
  expect(screen.getByText('message：permission_denied')).toBeOnTheScreen();
  expect(screen.getByText('diagnostic：permission_denied')).toBeOnTheScreen();
  expect(
    screen.getByText('请到系统设置授权或恢复相机权限后重试。')
  ).toBeOnTheScreen();
  // 状态 Icon 同样是装饰件、a11y 子树隐藏(语义由同排 Tag 文案承担)。
  expect(
    screen.getByTestId('result-status-icon-403', {
      includeHiddenElements: true,
    })
  ).toBeOnTheScreen();
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

  fireEvent.press(screen.getByRole('button', { name: /基础拍摄/ }));
  fireEvent.press(screen.getByRole('button', { name: '打开相机' }));
  await waitFor(() => {
    expect(screen.getByText('已取消')).toBeOnTheScreen();
  });
  expect(
    screen.queryByText('录像失败（保留码，当前实现不主动触发）')
  ).not.toBeOnTheScreen();

  fireEvent.press(screen.getByRole('button', { name: '打开相机' }));
  await waitFor(() => {
    expect(
      screen.getByText('录像失败（保留码，当前实现不主动触发）')
    ).toBeOnTheScreen();
  });
});
