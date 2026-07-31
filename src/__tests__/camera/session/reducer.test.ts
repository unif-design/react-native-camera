import type { CustomPhotoFile } from '../../../utils';
import {
  cameraSessionReducer,
  selectCapabilities,
} from '../../../camera/session/reducer';
import type {
  CameraSessionPhase,
  CameraSessionState,
} from '../../../camera/session/types';

const photo: CustomPhotoFile = {
  id: 'photo-1',
  cameraType: 'back',
  cameraMode: 'single',
  path: '/tmp/photo-1.jpg',
  uri: 'file:///tmp/photo-1.jpg',
  width: 3024,
  height: 4032,
  mime: 'image/jpeg',
  mode: 'single',
  isRemake: false,
};

function makeState(
  overrides: Partial<CameraSessionState> = {}
): CameraSessionState {
  return {
    phase: 'ready',
    files: [],
    modeIndex: 0,
    aspectRatio: '16:9',
    activePosition: 'back',
    canFlip: true,
    flash: 'off',
    sound: false,
    preview: null,
    operationId: null,
    configurationGeneration: 0,
    nativeConfigurationKey: 'device=back-1|output=photo',
    video: { duration: 0, reason: null },
    ...overrides,
  };
}

describe('selectCapabilities', () => {
  it.each<
    [
      CameraSessionPhase,
      {
        capture: boolean;
        flip: boolean;
        mode: boolean;
        aspect: boolean;
        save: boolean;
        gallery: boolean;
        zoom: boolean;
        focus: boolean;
        userCancel: boolean;
      },
    ]
  >([
    [
      'configuring',
      {
        capture: false,
        flip: false,
        mode: false,
        aspect: false,
        save: false,
        gallery: false,
        zoom: false,
        focus: false,
        userCancel: true,
      },
    ],
    [
      'ready',
      {
        capture: true,
        flip: true,
        mode: true,
        aspect: true,
        save: true,
        gallery: true,
        zoom: true,
        focus: true,
        userCancel: true,
      },
    ],
    [
      'capturingPhoto',
      {
        capture: false,
        flip: false,
        mode: false,
        aspect: false,
        save: false,
        gallery: false,
        zoom: false,
        focus: false,
        userCancel: false,
      },
    ],
    [
      'processingPhoto',
      {
        capture: false,
        flip: false,
        mode: false,
        aspect: false,
        save: false,
        gallery: false,
        zoom: false,
        focus: false,
        userCancel: false,
      },
    ],
    [
      'startingVideo',
      {
        capture: false,
        flip: false,
        mode: false,
        aspect: false,
        save: false,
        gallery: false,
        zoom: false,
        focus: false,
        userCancel: false,
      },
    ],
    [
      'recording',
      {
        capture: true,
        flip: false,
        mode: false,
        aspect: false,
        save: false,
        gallery: false,
        zoom: true,
        focus: true,
        userCancel: true,
      },
    ],
    [
      'stoppingVideo',
      {
        capture: false,
        flip: false,
        mode: false,
        aspect: false,
        save: false,
        gallery: false,
        zoom: false,
        focus: false,
        userCancel: false,
      },
    ],
    [
      'previewing',
      {
        capture: false,
        flip: false,
        mode: false,
        aspect: false,
        save: true,
        gallery: true,
        zoom: false,
        focus: false,
        userCancel: true,
      },
    ],
    [
      'settling',
      {
        capture: false,
        flip: false,
        mode: false,
        aspect: false,
        save: false,
        gallery: false,
        zoom: false,
        focus: false,
        userCancel: false,
      },
    ],
    [
      'closed',
      {
        capture: false,
        flip: false,
        mode: false,
        aspect: false,
        save: false,
        gallery: false,
        zoom: false,
        focus: false,
        userCancel: false,
      },
    ],
  ])('derives every control capability for %s', (phase, expected) => {
    const files = phase === 'ready' ? [photo] : [];
    expect(selectCapabilities(makeState({ phase, files }))).toEqual(expected);
  });

  it('disables ready save and gallery without files and flip without a target', () => {
    expect(
      selectCapabilities(makeState({ files: [], canFlip: false }))
    ).toMatchObject({
      save: false,
      gallery: false,
      flip: false,
    });
  });
});

describe('cameraSessionReducer', () => {
  it('returns the same state identity for an action invalid in the current phase', () => {
    const state = makeState({ phase: 'capturingPhoto', operationId: 1 });
    expect(
      cameraSessionReducer(state, { type: 'SET_ASPECT', aspectRatio: '4:3' })
    ).toBe(state);
  });

  it('keeps stale photo completion and failure from updating state', () => {
    const state = makeState({
      phase: 'processingPhoto',
      operationId: 8,
    });
    expect(
      cameraSessionReducer(state, {
        type: 'PHOTO_SUCCEEDED',
        operationId: 7,
        file: photo,
      })
    ).toBe(state);
    expect(
      cameraSessionReducer(state, {
        type: 'OPERATION_FAILED',
        operationId: 7,
      })
    ).toBe(state);
  });

  it.each<CameraSessionPhase>(['startingVideo', 'recording', 'stoppingVideo'])(
    'finalizes video from %s',
    (phase) => {
      const state = makeState({ phase, operationId: 4 });
      const next = cameraSessionReducer(state, {
        type: 'VIDEO_FINISHED',
        operationId: 4,
        file: {
          ...photo,
          id: 'video-1',
          path: '/tmp/video-1.mp4',
          uri: 'file:///tmp/video-1.mp4',
          mime: 'video/mp4',
          mode: 'video',
          cameraMode: 'video',
          duration: 12,
        },
        duration: 12,
        reason: 'completed',
      });

      expect(next).toMatchObject({
        phase: 'ready',
        operationId: null,
        video: { duration: 12, reason: 'completed' },
      });
      expect(next.files).toHaveLength(1);
    }
  );

  it('stores photo files and preview context after processing', () => {
    const state = makeState({
      phase: 'processingPhoto',
      operationId: 3,
    });
    const next = cameraSessionReducer(state, {
      type: 'PHOTO_SUCCEEDED',
      operationId: 3,
      file: photo,
      preview: { variant: 'confirm', index: 0 },
    });

    expect(next).toMatchObject({
      phase: 'previewing',
      files: [photo],
      preview: { variant: 'confirm', index: 0 },
      operationId: null,
    });
  });

  it('stores mode, aspect, actual position, flash and sound in reducer state', () => {
    let state = makeState();
    state = cameraSessionReducer(state, { type: 'SET_MODE', modeIndex: 1 });
    state = cameraSessionReducer(state, {
      type: 'SET_ASPECT',
      aspectRatio: '4:3',
    });
    state = cameraSessionReducer(state, {
      type: 'SET_ACTIVE_DEVICE',
      activePosition: 'front',
      canFlip: false,
    });
    state = cameraSessionReducer(state, { type: 'SET_FLASH', flash: 'auto' });
    state = cameraSessionReducer(state, { type: 'SET_SOUND', sound: true });

    expect(state).toMatchObject({
      modeIndex: 1,
      aspectRatio: '4:3',
      activePosition: 'front',
      canFlip: false,
      flash: 'auto',
      sound: true,
    });
  });

  it('rejects business actions after settling begins', () => {
    const settling = cameraSessionReducer(makeState(), { type: 'SETTLING' });

    expect(
      cameraSessionReducer(settling, {
        type: 'CAPTURE_PHOTO',
        operationId: 1,
      })
    ).toBe(settling);
    expect(
      cameraSessionReducer(settling, { type: 'SET_SOUND', sound: true })
    ).toBe(settling);
  });
});
