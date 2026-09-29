import type {
  CameraController,
  CameraInput,
  CameraMedia,
  CameraModeOptions,
  CameraOutcome,
  CameraWatermark,
} from '@unif/react-native-camera';

it('accepts mode-specific options and readonly inputs', () => {
  const modes = [
    { mode: 'single', quality: 0.9, qualityPriority: 'quality', hdr: true },
    { mode: 'continuous' },
    { mode: 'video', maxDurationSeconds: 15, bitRate: 20_000_000 },
  ] as const satisfies readonly CameraModeOptions[];
  const watermark = {
    lines: ['标题'],
    position: 'top-right',
  } as const satisfies CameraWatermark;
  const input = {
    modes,
    initialFacing: 'front',
    initialFlash: 'auto',
    retention: 'clear',
    watermark,
  } as const satisfies CameraInput;
  expect(input.modes).toHaveLength(3);
  expect(input.watermark.lines).toEqual(['标题']);
});

it('exposes only readable media metadata and discriminated outcomes', () => {
  const media: CameraMedia = {
    id: 'video-1',
    uri: 'file:///tmp/video.mp4',
    facing: 'back',
    mode: 'video',
    mimeType: 'video/mp4',
    width: 1920,
    height: 1080,
    durationMs: 12500,
  };
  const outcomes: CameraOutcome[] = [
    { status: 'success', media: [media] },
    { status: 'cancelled' },
    { status: 'failed', error: { reason: 'unsupported', message: 'Web' } },
  ];
  expect(outcomes.map((outcome) => outcome.status)).toEqual([
    'success',
    'cancelled',
    'failed',
  ]);
});

it('rejects cross-mode and removed public fields at the type boundary', () => {
  // @ts-expect-error quality only belongs to photo modes.
  const videoQuality: CameraModeOptions = { mode: 'video', quality: 0.8 };
  const photoDuration: CameraModeOptions = {
    mode: 'single',
    // @ts-expect-error recording limits only belong to video mode.
    maxDurationSeconds: 10,
  };
  const photoBitRate: CameraModeOptions = {
    mode: 'continuous',
    // @ts-expect-error bitrate only belongs to video mode.
    bitRate: 20_000_000,
  };
  // @ts-expect-error HDR only belongs to photo modes.
  const videoHdr: CameraModeOptions = { mode: 'video', hdr: true };
  // @ts-expect-error the initial facing belongs to CameraInput.
  const modeFacing: CameraModeOptions = { mode: 'single', type: 'front' };
  const legacyInput: CameraInput = {
    // @ts-expect-error the old input shape is not supported.
    cameraMode: [{ mode: 'single' }],
    dataRetainedMode: 'clear',
  };
  // @ts-expect-error watermark text uses lines.
  const legacyWatermark: CameraWatermark = { content: ['title'] };
  const controller = {} as CameraController;
  // @ts-expect-error cancellation belongs to the call's AbortController.
  const close = controller.close;
  const outcome = { status: 'cancelled' } as CameraOutcome;
  // @ts-expect-error media is only present after status narrowing to success.
  const media = outcome.media;
  expect([
    videoQuality,
    photoDuration,
    photoBitRate,
    videoHdr,
    modeFacing,
    legacyInput,
    legacyWatermark,
  ]).toHaveLength(7);
  expect(close).toBeUndefined();
  expect(media).toBeUndefined();
});
