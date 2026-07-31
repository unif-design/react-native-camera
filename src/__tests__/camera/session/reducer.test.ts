import type { CustomPhotoFile } from '../../../utils';
import {
  cameraSessionReducer,
  selectCapabilities,
} from '../../../camera/session/reducer';
import type {
  CameraSessionAction,
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

function photoWithId(id: string): CustomPhotoFile {
  return {
    ...photo,
    id,
    path: `/tmp/${id}.jpg`,
    uri: `file:///tmp/${id}.jpg`,
  };
}

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
      cameraSessionReducer(state, {
        type: 'CAPTURE_PHOTO',
        operationId: 2,
      })
    ).toBe(state);
  });

  it.each([
    { type: 'SET_MODE', modeIndex: 1 },
    { type: 'SET_ASPECT', aspectRatio: '4:3' },
    {
      type: 'SET_ACTIVE_DEVICE',
      activePosition: 'front',
      canFlip: false,
    },
  ])('ignores legacy native context setter $type', (legacyAction) => {
    const state = makeState();
    expect(
      cameraSessionReducer(
        state,
        legacyAction as unknown as CameraSessionAction
      )
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

  it('deletes by path while preserving the current preview file identity', () => {
    const first = photoWithId('first');
    const current = photoWithId('current');
    const last = photoWithId('last');
    const state = makeState({
      phase: 'previewing',
      files: [first, current, last],
      preview: { variant: 'gallery', index: 1 },
    });

    const afterBefore = cameraSessionReducer(state, {
      type: 'DELETE_FILE',
      path: first.path,
    });
    expect(afterBefore.files).toEqual([current, last]);
    expect(afterBefore.files[afterBefore.preview!.index]).toBe(current);

    const afterCurrent = cameraSessionReducer(afterBefore, {
      type: 'DELETE_FILE',
      path: current.path,
    });
    expect(afterCurrent.files).toEqual([last]);
    expect(afterCurrent.files[afterCurrent.preview!.index]).toBe(last);

    const afterLast = cameraSessionReducer(afterCurrent, {
      type: 'DELETE_FILE',
      path: last.path,
    });
    expect(afterLast).toMatchObject({
      phase: 'ready',
      files: [],
      preview: null,
    });
  });

  it('clamps preview to the previous file when deleting the current last file', () => {
    const first = photoWithId('first');
    const last = photoWithId('last');
    const state = makeState({
      phase: 'previewing',
      files: [first, last],
      preview: { variant: 'gallery', index: 1 },
    });

    const next = cameraSessionReducer(state, {
      type: 'DELETE_FILE',
      path: last.path,
    });

    expect(next.files).toEqual([first]);
    expect(next.preview).toEqual({ variant: 'gallery', index: 0 });
    expect(next.files[next.preview!.index]).toBe(first);
  });

  it('defensively clamps an out-of-range preview index after deletion', () => {
    const first = photoWithId('first');
    const second = photoWithId('second');
    const last = photoWithId('last');
    const state = makeState({
      phase: 'previewing',
      files: [first, second, last],
      preview: { variant: 'gallery', index: 99 },
    });

    const next = cameraSessionReducer(state, {
      type: 'DELETE_FILE',
      path: first.path,
    });

    expect(next.files).toEqual([second, last]);
    expect(next.preview).toEqual({ variant: 'gallery', index: 1 });
  });

  it('clears files from ready or previewing and exits preview', () => {
    const files = [photoWithId('first'), photoWithId('last')];
    const ready = makeState({ files });
    const previewing = makeState({
      phase: 'previewing',
      files,
      preview: { variant: 'gallery', index: 1 },
    });

    expect(cameraSessionReducer(ready, { type: 'CLEAR_FILES' })).toMatchObject({
      phase: 'ready',
      files: [],
      preview: null,
    });
    expect(
      cameraSessionReducer(previewing, { type: 'CLEAR_FILES' })
    ).toMatchObject({
      phase: 'ready',
      files: [],
      preview: null,
    });
  });

  it.each<CameraSessionPhase>([
    'configuring',
    'capturingPhoto',
    'processingPhoto',
    'startingVideo',
    'recording',
    'stoppingVideo',
    'settling',
    'closed',
  ])('keeps identity for file mutations while %s', (phase) => {
    const state = makeState({
      phase,
      files: [photo],
      preview: phase === 'previewing' ? { variant: 'gallery', index: 0 } : null,
    });

    expect(
      cameraSessionReducer(state, {
        type: 'DELETE_FILE',
        path: photo.path,
      })
    ).toBe(state);
    expect(cameraSessionReducer(state, { type: 'CLEAR_FILES' })).toBe(state);
  });

  it('keeps identity for a missing delete path and unknown action', () => {
    const state = makeState({
      phase: 'previewing',
      files: [photo],
      preview: { variant: 'gallery', index: 0 },
    });

    expect(
      cameraSessionReducer(state, {
        type: 'DELETE_FILE',
        path: '/tmp/missing.jpg',
      })
    ).toBe(state);
    expect(
      cameraSessionReducer(state, {
        type: 'NOT_A_FILE_ACTION',
      } as unknown as CameraSessionAction)
    ).toBe(state);
  });

  it('stores non-native flash and sound controls in reducer state', () => {
    let state = makeState();
    state = cameraSessionReducer(state, { type: 'SET_FLASH', flash: 'auto' });
    state = cameraSessionReducer(state, { type: 'SET_SOUND', sound: true });

    expect(state).toMatchObject({
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
