import { fireEvent, render, screen } from '@testing-library/react-native';

import type {
  CameraRunController,
  CameraRunSnapshot,
} from '../../../example/src/domain/cameraRun';
import { QualityLabScreen } from '../../../example/src/screens/QualityLabScreen';
import { WatermarkEvidenceScreen } from '../../../example/src/screens/WatermarkEvidenceScreen';

// 根 Jest renderer 与 example workspace 必须共享同一 React hook dispatcher。
jest.mock('../../../example/node_modules/react', () =>
  jest.requireActual('react')
);

jest.mock(
  '@unif/react-native-design',
  () => require('../__helpers__/exampleDesignMock'),
  { virtual: true }
);

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

it('水印页在点击时注入当前时间、trim 手工字段并提交所选位置', () => {
  const run = createRun();
  const now = jest.fn(() => new Date('2026-08-03T10:20:30.000Z'));
  render(<WatermarkEvidenceScreen run={run} now={now} onBack={jest.fn()} />);

  fireEvent.changeText(screen.getByLabelText('记录标题'), '  设备巡检记录  ');
  fireEvent.changeText(screen.getByLabelText('手工地点'), '  A 区东门  ');
  fireEvent.changeText(screen.getByLabelText('备注'), '  门锁完好  ');
  fireEvent.press(screen.getByRole('tab', { name: '右下' }));

  expect(now).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: '打开相机' }));

  expect(now).toHaveBeenCalledTimes(1);
  expect(run.open).toHaveBeenCalledWith('watermark-evidence', {
    cameraMode: [{ mode: 'single', quality: 0.9 }],
    dataRetainedMode: 'clear',
    watermark: {
      content: [
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
  render(
    <WatermarkEvidenceScreen
      run={run}
      now={() => new Date('2026-08-03T10:20:30.000Z')}
      onBack={jest.fn()}
    />
  );

  fireEvent.changeText(screen.getByLabelText('记录标题'), ' \n ');
  fireEvent.press(screen.getByRole('button', { name: '打开相机' }));

  expect(screen.getByText('请输入记录标题')).toBeOnTheScreen();
  expect(run.open).not.toHaveBeenCalled();
});

it('质量页照片默认值从 OpenConfig 完全省略 SDK 可选 key', () => {
  const run = createRun();
  render(<QualityLabScreen run={run} onBack={jest.fn()} />);

  fireEvent.press(screen.getByRole('button', { name: '打开相机' }));

  expect(run.open).toHaveBeenCalledTimes(1);
  const config = jest.mocked(run.open).mock.calls[0]?.[1];
  expect(config).toEqual({
    cameraMode: [{ mode: 'single', quality: 0.9 }],
    dataRetainedMode: 'clear',
  });
  expect(Object.hasOwn(config ?? {}, 'photoQualityPrioritization')).toBe(false);
  expect(Object.hasOwn(config ?? {}, 'photoHDR')).toBe(false);
  expect(Object.hasOwn(config ?? {}, 'videoBitRate')).toBe(false);
});

it('质量页提交精确照片 quality、prioritization 与 HDR 配置', () => {
  const run = createRun();
  render(<QualityLabScreen run={run} onBack={jest.fn()} />);

  fireEvent.changeText(screen.getByLabelText('JPEG quality'), '0.85');
  fireEvent.press(screen.getByRole('tab', { name: '质量优先' }));
  fireEvent.press(screen.getByRole('tab', { name: '显式控制' }));
  fireEvent.press(screen.getByRole('switch', { name: '照片 HDR' }));
  fireEvent.press(screen.getByRole('button', { name: '打开相机' }));

  expect(run.open).toHaveBeenCalledWith('quality-lab', {
    cameraMode: [{ mode: 'single', quality: 0.85 }],
    dataRetainedMode: 'clear',
    photoQualityPrioritization: 'quality',
    photoHDR: true,
  });
});

it('质量页录像实验只提交 recTime 与显式 24Mbps', () => {
  const run = createRun();
  render(<QualityLabScreen run={run} onBack={jest.fn()} />);

  fireEvent.press(screen.getByRole('tab', { name: '录像实验' }));
  fireEvent.press(screen.getByRole('tab', { name: '显式码率' }));
  fireEvent.changeText(screen.getByLabelText('视频码率（bps）'), '24000000');
  fireEvent.press(screen.getByRole('button', { name: '打开相机' }));

  expect(run.open).toHaveBeenCalledWith('quality-lab', {
    cameraMode: [{ mode: 'video', recTime: 15 }],
    dataRetainedMode: 'clear',
    videoBitRate: 24_000_000,
  });
});
