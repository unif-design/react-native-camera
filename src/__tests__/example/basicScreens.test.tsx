import { fireEvent, render, screen } from '@testing-library/react-native';
import type {
  CameraRunController,
  CameraRunRecord,
  CameraRunSnapshot,
} from '../../../example/src/domain/cameraRun';
import { BasicCaptureScreen } from '../../../example/src/screens/BasicCaptureScreen';
import { HomeScreen } from '../../../example/src/screens/HomeScreen';
import { MultiModeScreen } from '../../../example/src/screens/MultiModeScreen';

// 根 Jest renderer 与 example workspace 必须共享同一 React hook dispatcher。
jest.mock('../../../example/node_modules/react', () =>
  jest.requireActual('react')
);

jest.mock(
  '@unif/react-native-design',
  () => {
    const React = require('react');
    const { Pressable, Text, View } = require('react-native');
    const passthrough = ({ children }: { children?: unknown }) =>
      React.createElement(View, null, children);

    return {
      Button: ({
        label,
        onPress,
        disabled,
        loading,
      }: {
        label: string;
        onPress?: () => void;
        disabled?: boolean;
        loading?: boolean;
      }) =>
        React.createElement(
          Pressable,
          {
            accessibilityRole: 'button',
            accessibilityLabel: label,
            accessibilityState: { disabled: Boolean(disabled || loading) },
            disabled: disabled || loading,
            onPress,
          },
          React.createElement(Text, null, label)
        ),
      Card: passthrough,
      EntryCard: ({
        title,
        sub,
        onPress,
      }: {
        title: string;
        sub?: string;
        onPress?: () => void;
      }) =>
        React.createElement(
          Pressable,
          {
            accessibilityRole: onPress ? 'button' : undefined,
            accessibilityLabel: onPress ? title : undefined,
            onPress,
          },
          React.createElement(Text, null, title),
          sub ? React.createElement(Text, null, sub) : null
        ),
      NavBar: ({
        title,
        left,
      }: {
        title: string;
        left?: {
          onPress: () => void;
          accessibilityLabel?: string;
        };
      }) =>
        React.createElement(
          View,
          null,
          left
            ? React.createElement(Pressable, {
                accessibilityRole: 'button',
                accessibilityLabel: left.accessibilityLabel,
                onPress: left.onPress,
              })
            : null,
          React.createElement(Text, null, title)
        ),
      Segmented: ({
        value,
        onChange,
        items,
      }: {
        value: string;
        onChange: (id: string) => void;
        items: readonly { id: string; label: string }[];
      }) =>
        React.createElement(
          View,
          null,
          ...items.map((item) =>
            React.createElement(
              Pressable,
              {
                key: item.id,
                accessibilityRole: 'tab',
                accessibilityLabel: item.label,
                accessibilityState: { selected: item.id === value },
                onPress: () => onChange(item.id),
              },
              React.createElement(Text, null, item.label)
            )
          )
        ),
      Tag: ({ label }: { label: string }) =>
        React.createElement(Text, null, label),
      fw: {
        regular: '400',
        semi: '600',
      },
      r: (value: number) => value,
      rf: (value: number) => value,
      useColors: () => new Proxy({}, { get: () => 'transparent' }),
      useThemedStyles: (maker: (colors: object, shadow: object) => object) =>
        maker(new Proxy({}, { get: () => 'transparent' }), {}),
    };
  },
  { virtual: true }
);

const historyRecord: CameraRunRecord = {
  id: 'run-1',
  scenario: 'basic-capture',
  startedAt: '2026-08-03T10:20:30.000Z',
  endedAt: '2026-08-03T10:20:31.000Z',
  config: {
    cameraMode: [{ mode: 'single', quality: 0.9 }],
    dataRetainedMode: 'clear',
  },
  result: {
    code: 200,
    data: [
      {
        id: 'photo-1',
        cameraType: 'back',
        cameraMode: 'single',
        path: '/tmp/photo.jpg',
        uri: 'file:///tmp/photo.jpg',
        width: 4032,
        height: 3024,
        mime: 'image/jpeg',
        mode: 'single',
        isRemake: false,
      },
    ],
    message: 'ok',
  },
};

function createRun(
  initial: Partial<CameraRunSnapshot> = {}
): CameraRunController {
  const snapshot: CameraRunSnapshot = {
    phase: initial.phase ?? 'idle',
    records: initial.records ?? [],
    diagnostics: initial.diagnostics ?? [],
  };

  return {
    open: jest.fn(async () => ({
      accepted: false as const,
      reason: 'busy' as const,
      snapshot,
    })),
    close: jest.fn(),
    getSnapshot: jest.fn(() => snapshot),
    clear: jest.fn(),
    subscribe: jest.fn(() => () => undefined),
  };
}

it('首页暴露四个场景入口并展示本进程拍摄历史', () => {
  const run = createRun({ records: [historyRecord] });
  const onNavigate = jest.fn();
  render(<HomeScreen run={run} onNavigate={onNavigate} />);

  const entries = [
    ['基础拍摄', { name: 'basic-capture' }],
    ['多模式', { name: 'multi-mode' }],
    ['水印存证', { name: 'watermark-evidence' }],
    ['质量实验室', { name: 'quality-lab' }],
  ] as const;

  for (const [label, route] of entries) {
    fireEvent.press(screen.getByRole('button', { name: label }));
    expect(onNavigate).toHaveBeenLastCalledWith(route);
  }
  expect(onNavigate).toHaveBeenCalledTimes(4);
  expect(screen.getByText('拍摄成功')).toBeOnTheScreen();
  expect(screen.getByText(/1 个临时文件/)).toBeOnTheScreen();
});

it('基础拍摄切换录像、前摄与关闭闪光后只提交录像字段', () => {
  const run = createRun();
  render(<BasicCaptureScreen run={run} onBack={jest.fn()} />);

  expect(screen.getByText('照片质量：0.9')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('tab', { name: '录像' }));
  fireEvent.press(screen.getByRole('tab', { name: '前摄' }));
  fireEvent.press(screen.getByRole('tab', { name: '关闭' }));

  expect(screen.queryByText('照片质量：0.9')).not.toBeOnTheScreen();
  expect(screen.getByText('最长录制：15 秒')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: '打开相机' }));

  expect(run.open).toHaveBeenCalledWith('basic-capture', {
    cameraMode: [
      { mode: 'video', type: 'front', flashMode: 'off', recTime: 15 },
    ],
    dataRetainedMode: 'clear',
  });
});

it('多模式 retain 同时更新解释、实际 JSON 与 controller 参数', () => {
  const run = createRun();
  render(<MultiModeScreen run={run} onBack={jest.fn()} />);

  expect(
    screen.getByText('切换拍摄模式时先确认，再清理已有文件。')
  ).toBeOnTheScreen();
  expect(screen.getByText(/"dataRetainedMode": "clear"/)).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('tab', { name: '跨模式保留' }));

  expect(
    screen.getByText('切换拍摄模式时保留已有文件，并继续累计。')
  ).toBeOnTheScreen();
  expect(screen.getByText(/"dataRetainedMode": "retain"/)).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: '打开相机' }));
  expect(run.open).toHaveBeenCalledWith('multi-mode', {
    cameraMode: [
      { mode: 'single', type: 'back', flashMode: 'auto', quality: 0.9 },
      { mode: 'continuous', quality: 0.9 },
      { mode: 'video', recTime: 15 },
    ],
    dataRetainedMode: 'retain',
  });
});

it.each([
  ['基础拍摄', BasicCaptureScreen],
  ['多模式', MultiModeScreen],
] as const)('%s opening 时禁用主按钮', (_name, ScreenComponent) => {
  const run = createRun({ phase: 'opening' });
  render(<ScreenComponent run={run} onBack={jest.fn()} />);

  const openButton = screen.getByRole('button', { name: '打开相机' });
  expect(openButton).toBeDisabled();
  fireEvent.press(openButton);
  expect(run.open).not.toHaveBeenCalled();
});
