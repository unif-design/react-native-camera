import { useState, type ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';

import type {
  CameraRunController,
  CameraRunSnapshot,
} from '../../../example/src/domain/cameraRun';
import {
  initialQualityLabDraft,
  QualityLabScreen,
} from '../../../example/src/screens/QualityLabScreen';
import {
  initialWatermarkEvidenceDraft,
  WatermarkEvidenceScreen,
} from '../../../example/src/screens/WatermarkEvidenceScreen';

// 屏幕跑的是真实 design 组件,真 useTheme 找不到 Provider 会 warn;这里的 ThemeProvider
// 对齐 example/src/App.tsx 的真实装配(默认跟随系统 scheme)。
const renderScreen = (ui: ReactElement) =>
  render(ui, { wrapper: ThemeProvider });

function createRun(): CameraRunController {
  const snapshot: CameraRunSnapshot = {
    phase: 'idle',
    records: [],
    diagnostics: [],
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

function WatermarkEvidenceHarness({
  run,
  now,
}: {
  run: CameraRunController;
  now: () => Date;
}): ReactElement {
  const [draft, setDraft] = useState(initialWatermarkEvidenceDraft);

  return (
    <WatermarkEvidenceScreen
      run={run}
      now={now}
      draft={draft}
      onDraftChange={setDraft}
      onBack={jest.fn()}
    />
  );
}

function QualityLabHarness({
  run,
}: {
  run: CameraRunController;
}): ReactElement {
  const [draft, setDraft] = useState(initialQualityLabDraft);

  return (
    <QualityLabScreen
      run={run}
      draft={draft}
      onDraftChange={setDraft}
      onBack={jest.fn()}
    />
  );
}

it('水印页在点击时注入当前时间、trim 手工字段并提交所选位置', () => {
  const run = createRun();
  const now = jest.fn(() => new Date('2026-08-03T10:20:30.000Z'));
  renderScreen(<WatermarkEvidenceHarness run={run} now={now} />);

  fireEvent.changeText(screen.getByLabelText('记录标题'), '  设备巡检记录  ');
  fireEvent.changeText(screen.getByLabelText('手工地点'), '  A 区东门  ');
  fireEvent.changeText(screen.getByLabelText('备注'), '  门锁完好  ');
  fireEvent.press(screen.getByRole('tab', { name: '右下' }));

  expect(now).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: '打开相机' }));

  expect(now).toHaveBeenCalledTimes(1);
  expect(run.open).toHaveBeenCalledWith('watermark-evidence', {
    modes: [{ mode: 'single', quality: 0.9 }],
    retention: 'clear',
    watermark: {
      lines: [
        '设备巡检记录',
        '拍摄时间：2026-08-03T10:20:30.000Z',
        '地点：A 区东门',
        '备注：门锁完好',
      ],
      position: 'bottom-right',
    },
  });
});

it('水印页阻止空标题提交，并显示字段错误', () => {
  const run = createRun();
  renderScreen(
    <WatermarkEvidenceHarness
      run={run}
      now={() => new Date('2026-08-03T10:20:30.000Z')}
    />
  );

  fireEvent.changeText(screen.getByLabelText('记录标题'), ' \n ');
  fireEvent.press(screen.getByRole('button', { name: '打开相机' }));

  expect(screen.getByText('请输入记录标题')).toBeOnTheScreen();
  expect(run.open).not.toHaveBeenCalled();
});

it('质量页照片默认值从 CameraInput 完全省略 SDK 可选 key', () => {
  const run = createRun();
  renderScreen(<QualityLabHarness run={run} />);

  fireEvent.press(screen.getByRole('button', { name: '打开相机' }));

  expect(run.open).toHaveBeenCalledTimes(1);
  const config = jest.mocked(run.open).mock.calls[0]?.[1];
  expect(config).toEqual({
    modes: [{ mode: 'single', quality: 0.9 }],
    retention: 'clear',
  });
  expect(Object.hasOwn(config ?? {}, 'photoQualityPrioritization')).toBe(false);
  expect(Object.hasOwn(config ?? {}, 'photoHDR')).toBe(false);
  expect(Object.hasOwn(config ?? {}, 'videoBitRate')).toBe(false);
});

it('质量页提交精确照片 quality、prioritization 与 HDR 配置', () => {
  const run = createRun();
  renderScreen(<QualityLabHarness run={run} />);

  fireEvent.changeText(screen.getByLabelText('JPEG quality'), '0.85');
  fireEvent.press(screen.getByRole('tab', { name: '质量优先' }));
  fireEvent.press(screen.getByRole('tab', { name: '显式控制' }));
  fireEvent.press(screen.getByRole('switch', { name: '照片 HDR' }));
  fireEvent.press(screen.getByRole('button', { name: '打开相机' }));

  expect(run.open).toHaveBeenCalledWith('quality-lab', {
    modes: [
      { mode: 'single', quality: 0.85, hdr: true, qualityPriority: 'quality' },
    ],
    retention: 'clear',
  });
});

it('质量页录像实验只提交 maxDurationSeconds 与显式 24Mbps', () => {
  const run = createRun();
  renderScreen(<QualityLabHarness run={run} />);

  fireEvent.press(screen.getByRole('tab', { name: '录像实验' }));
  fireEvent.press(screen.getByRole('tab', { name: '显式码率' }));
  fireEvent.changeText(screen.getByLabelText('视频码率（bps）'), '24000000');
  fireEvent.press(screen.getByRole('button', { name: '打开相机' }));

  expect(run.open).toHaveBeenCalledWith('quality-lab', {
    modes: [{ mode: 'video', maxDurationSeconds: 15, bitRate: 24_000_000 }],
    retention: 'clear',
  });
});
