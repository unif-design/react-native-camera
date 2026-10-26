import { act, fireEvent, render } from '@testing-library/react-native';
import {
  ThemeProvider,
  Segmented,
  Button,
  Stepper,
} from '@unif/react-native-design';
import { Text } from 'react-native';
import { createCameraRunController } from '../domain/cameraRun';
import {
  BasicCaptureScreen,
  initialBasicCaptureDraft,
} from '../screens/BasicCaptureScreen';
import {
  MultiModeScreen,
  initialMultiModeDraft,
} from '../screens/MultiModeScreen';
import {
  QualityLabScreen,
  initialQualityLabDraft,
} from '../screens/QualityLabScreen';
import {
  WatermarkEvidenceScreen,
  initialWatermarkEvidenceDraft,
} from '../screens/WatermarkEvidenceScreen';
import { ShowcaseScaffold } from '../components/ShowcaseScaffold';

const now = () => new Date('2026-10-16T10:00:00Z');
function setupRun() {
  const open = jest.fn().mockResolvedValue({ status: 'cancelled' });
  const run = createCameraRunController({
    api: { open },
    now,
    nextId: () => 'latest',
  });
  return { run, open };
}

it('all screen controls ignore unknown segmented values without changing drafts', () => {
  const { run } = setupRun();
  const onDraftChange = jest.fn();
  const onBack = jest.fn();
  const screens = [
    <BasicCaptureScreen
      run={run}
      draft={initialBasicCaptureDraft}
      onDraftChange={onDraftChange}
      onBack={onBack}
    />,
    <MultiModeScreen
      run={run}
      draft={initialMultiModeDraft}
      onDraftChange={onDraftChange}
      onBack={onBack}
    />,
    <QualityLabScreen
      run={run}
      draft={initialQualityLabDraft}
      onDraftChange={onDraftChange}
      onBack={onBack}
    />,
    <QualityLabScreen
      run={run}
      draft={{ ...initialQualityLabDraft, kind: 'video' }}
      onDraftChange={onDraftChange}
      onBack={onBack}
    />,
    <WatermarkEvidenceScreen
      run={run}
      now={now}
      draft={initialWatermarkEvidenceDraft}
      onDraftChange={onDraftChange}
      onBack={onBack}
    />,
  ];
  for (const screen of screens) {
    const view = render(screen, { wrapper: ThemeProvider });
    act(() => {
      for (const control of view.UNSAFE_getAllByType(Segmented))
        control.props.onChange('unknown');
    });
    expect(onDraftChange).not.toHaveBeenCalled();
    view.unmount();
  }
});

it.each(['', 'NaN', '-0.1', '1.1'])(
  'invalid JPEG quality %s prevents camera entry even for a retained press callback',
  async (photoQualityText) => {
    const { run, open } = setupRun();
    const view = render(
      <QualityLabScreen
        run={run}
        draft={{ ...initialQualityLabDraft, photoQualityText }}
        onDraftChange={jest.fn()}
        onBack={jest.fn()}
      />,
      { wrapper: ThemeProvider }
    );
    expect(view.getByText('请输入 0 到 1 的有限数')).toBeTruthy();
    expect(view.getByRole('button', { name: '打开相机' })).toBeDisabled();
    await act(async () => {
      await view.UNSAFE_getByType(Button).props.onPress();
    });
    expect(open).not.toHaveBeenCalled();
  }
);

it.each(['', 'Infinity', '0', '-1'])(
  'invalid explicit bitrate %s disables video submission',
  (videoBitRateText) => {
    const { run, open } = setupRun();
    const view = render(
      <QualityLabScreen
        run={run}
        draft={{
          ...initialQualityLabDraft,
          kind: 'video',
          bitRatePolicy: 'explicit',
          videoBitRateText,
        }}
        onDraftChange={jest.fn()}
        onBack={jest.fn()}
      />,
      { wrapper: ThemeProvider }
    );
    expect(view.getByText('请输入大于 0 的有限码率')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: '打开相机' }));
    expect(open).not.toHaveBeenCalled();
  }
);

it('explicit HDR off is preserved and video duration changes are forwarded', async () => {
  const { run, open } = setupRun();
  const onDraftChange = jest.fn();
  const draft = { ...initialQualityLabDraft, hdrPolicy: 'explicit' as const };
  const view = render(
    <QualityLabScreen
      run={run}
      draft={draft}
      onDraftChange={onDraftChange}
      onBack={jest.fn()}
    />,
    { wrapper: ThemeProvider }
  );
  await act(async () => {
    fireEvent.press(view.getByRole('button', { name: '打开相机' }));
  });
  expect(open).toHaveBeenCalledWith(
    {
      modes: [{ mode: 'single', quality: 0.9, hdr: false }],
      retention: 'clear',
    },
    expect.any(Object)
  );
  view.rerender(
    <QualityLabScreen
      run={run}
      draft={{ ...draft, kind: 'video' }}
      onDraftChange={onDraftChange}
      onBack={jest.fn()}
    />
  );
  act(() => view.UNSAFE_getByType(Stepper).props.onChange(20));
  expect(onDraftChange).toHaveBeenCalledWith(
    expect.objectContaining({ maxDurationSeconds: 20, kind: 'video' })
  );
});

it('all scenarios display the history produced by the real run controller', async () => {
  const { run } = setupRun();
  for (const scenario of [
    'multi-mode',
    'quality-lab',
    'watermark-evidence',
  ] as const) {
    await run.open(scenario, {
      modes: [{ mode: 'single' }],
      retention: 'clear',
    });
  }
  const onDraftChange = jest.fn();
  const onBack = jest.fn();
  const screens = [
    <MultiModeScreen
      run={run}
      draft={initialMultiModeDraft}
      onDraftChange={onDraftChange}
      onBack={onBack}
    />,
    <QualityLabScreen
      run={run}
      draft={initialQualityLabDraft}
      onDraftChange={onDraftChange}
      onBack={onBack}
    />,
    <WatermarkEvidenceScreen
      run={run}
      now={now}
      draft={initialWatermarkEvidenceDraft}
      onDraftChange={onDraftChange}
      onBack={onBack}
    />,
  ];
  for (const screen of screens) {
    const view = render(screen, { wrapper: ThemeProvider });
    expect(view.getByText('已取消')).toBeTruthy();
    view.unmount();
  }
});

it('top watermark positions update the draft', () => {
  const { run } = setupRun();
  const onDraftChange = jest.fn();
  const view = render(
    <WatermarkEvidenceScreen
      run={run}
      now={now}
      draft={initialWatermarkEvidenceDraft}
      onDraftChange={onDraftChange}
      onBack={jest.fn()}
    />,
    { wrapper: ThemeProvider }
  );
  fireEvent.press(view.getByRole('tab', { name: '左上' }));
  expect(onDraftChange).toHaveBeenCalledWith(
    expect.objectContaining({ position: 'top-left' })
  );
});

it('optional scaffold description and back action may both be absent', () => {
  const view = render(
    <ShowcaseScaffold title="Standalone">
      <Text>content</Text>
    </ShowcaseScaffold>,
    { wrapper: ThemeProvider }
  );
  expect(view.getByText('content')).toBeTruthy();
  expect(view.queryByRole('button', { name: '返回' })).toBeNull();
});
