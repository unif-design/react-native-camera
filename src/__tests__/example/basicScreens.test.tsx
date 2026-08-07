import { useState, type ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import type {
  CameraRunController,
  CameraRunRecord,
  CameraRunSnapshot,
} from '../../../example/src/domain/cameraRun';
import {
  BasicCaptureScreen,
  initialBasicCaptureDraft,
} from '../../../example/src/screens/BasicCaptureScreen';
import { HomeScreen } from '../../../example/src/screens/HomeScreen';
import {
  initialMultiModeDraft,
  MultiModeScreen,
} from '../../../example/src/screens/MultiModeScreen';

// 屏幕跑的是真实 design 组件,真 useTheme 找不到 Provider 会 warn;这里的 ThemeProvider
// 对齐 example/src/App.tsx 的真实装配(默认跟随系统 scheme)。
const renderScreen = (ui: ReactElement) =>
  render(ui, { wrapper: ThemeProvider });

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

type ScreenHarnessProps = {
  run: CameraRunController;
  onBack: () => void;
};

function BasicCaptureHarness({
  run,
  onBack,
}: ScreenHarnessProps): ReactElement {
  const [draft, setDraft] = useState(initialBasicCaptureDraft);

  return (
    <BasicCaptureScreen
      run={run}
      draft={draft}
      onDraftChange={setDraft}
      onBack={onBack}
    />
  );
}

function MultiModeHarness({ run, onBack }: ScreenHarnessProps): ReactElement {
  const [draft, setDraft] = useState(initialMultiModeDraft);

  return (
    <MultiModeScreen
      run={run}
      draft={draft}
      onDraftChange={setDraft}
      onBack={onBack}
    />
  );
}

it('首页暴露四个场景入口并展示本进程拍摄历史', () => {
  const run = createRun({ records: [historyRecord] });
  const onNavigate = jest.fn();
  renderScreen(<HomeScreen run={run} onNavigate={onNavigate} />);

  const entries = [
    ['基础拍摄', { name: 'basic-capture' }],
    ['多模式', { name: 'multi-mode' }],
    ['水印存证', { name: 'watermark-evidence' }],
    ['质量实验室', { name: 'quality-lab' }],
  ] as const;

  for (const [label, route] of entries) {
    fireEvent.press(screen.getByRole('button', { name: new RegExp(label) }));
    expect(onNavigate).toHaveBeenLastCalledWith(route);
  }
  expect(onNavigate).toHaveBeenCalledTimes(4);
  expect(screen.getByText('拍摄成功')).toBeOnTheScreen();
  expect(screen.getByText(/1 个临时文件/)).toBeOnTheScreen();
});

it('基础拍摄切换录像、前摄与关闭闪光后只提交录像字段', () => {
  const run = createRun();
  renderScreen(<BasicCaptureHarness run={run} onBack={jest.fn()} />);

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
  renderScreen(<MultiModeHarness run={run} onBack={jest.fn()} />);

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
  ['基础拍摄', BasicCaptureHarness],
  ['多模式', MultiModeHarness],
] as const)('%s opening 时禁用主按钮', (_name, ScreenComponent) => {
  const run = createRun({ phase: 'opening' });
  renderScreen(<ScreenComponent run={run} onBack={jest.fn()} />);

  const openButton = screen.getByRole('button', { name: '打开相机' });
  expect(openButton).toBeDisabled();
  fireEvent.press(openButton);
  expect(run.open).not.toHaveBeenCalled();
});
