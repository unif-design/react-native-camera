import type { CameraDevice } from 'react-native-vision-camera';
import { makeDeviceStub } from '../../__helpers__/visionCameraMock';
import {
  nativeConfigurationKey,
  type NativeConfiguration,
} from '../../../camera/session/configuration';
import { selectCameraDevice } from '../../../camera/session/deviceSelection';
import { cameraSessionReducer } from '../../../camera/session/reducer';
import type { CameraSessionState } from '../../../camera/session/types';

const baseConfiguration: NativeConfiguration = {
  device: { id: 'back-wide', position: 'back' },
  mode: { mode: 'single', quality: 0.9 },
  aspectRatio: '16:9',
};

function key(overrides: Partial<NativeConfiguration> = {}): string {
  return nativeConfigurationKey({ ...baseConfiguration, ...overrides });
}

function makeState(
  nativeKey = key(),
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
    nativeConfigurationKey: nativeKey,
    video: { duration: 0, reason: null },
    ...overrides,
  };
}

function device(position: 'back' | 'front'): CameraDevice {
  return makeDeviceStub({ position }) as unknown as CameraDevice;
}

describe('nativeConfigurationKey', () => {
  it('changes photo identity for the requested final aspect but not single/continuous UI mode', () => {
    expect(key({ aspectRatio: '4:3' })).not.toBe(key());
    expect(key({ mode: { mode: 'continuous', quality: 0.9 } })).toBe(key());
  });

  it.each([
    [
      'device id',
      { device: { id: 'back-telephoto', position: 'back' as const } },
    ],
    [
      'device position',
      { device: { id: 'back-wide', position: 'front' as const } },
    ],
    ['photo to video output', { mode: { mode: 'video' as const } }],
    ['photo quality', { mode: { mode: 'single' as const, quality: 0.8 } }],
    ['photo HDR', { photoHDR: true }],
    [
      'photo prioritization',
      { photoQualityPrioritization: 'quality' as const },
    ],
  ])('changes for %s', (_label, change) => {
    expect(key(change)).not.toBe(key());
  });

  it('changes video identity for aspect and bitrate', () => {
    const video: NativeConfiguration = {
      ...baseConfiguration,
      mode: { mode: 'video' },
      videoBitRate: 20_000_000,
    };
    expect(nativeConfigurationKey({ ...video, aspectRatio: '4:3' })).not.toBe(
      nativeConfigurationKey(video)
    );
    expect(
      nativeConfigurationKey({ ...video, videoBitRate: 40_000_000 })
    ).not.toBe(nativeConfigurationKey(video));
  });
});

describe('configuration generation', () => {
  it('keeps single/continuous photo changes ready without waiting for a callback', () => {
    const state = makeState();
    const sameKey = key({
      mode: { mode: 'continuous', quality: 0.9 },
    });
    const next = cameraSessionReducer(state, {
      type: 'BEGIN_CONFIGURATION',
      nativeConfigurationKey: sameKey,
      changes: { modeIndex: 1 },
    });

    expect(next).toMatchObject({
      phase: 'ready',
      modeIndex: 1,
      configurationGeneration: 0,
    });
  });

  it('atomically reconfigures photo output when the requested final aspect changes', () => {
    const nextKey = key({ aspectRatio: '4:3' });
    const next = cameraSessionReducer(makeState(), {
      type: 'BEGIN_CONFIGURATION',
      nativeConfigurationKey: nextKey,
      changes: { aspectRatio: '4:3' },
    });

    expect(next).toMatchObject({
      phase: 'configuring',
      aspectRatio: '4:3',
      nativeConfigurationKey: nextKey,
      configurationGeneration: 1,
    });
  });

  it('atomically enters configuring when photo mode changes to video', () => {
    const nextKey = key({ mode: { mode: 'video' } });
    const next = cameraSessionReducer(makeState(), {
      type: 'BEGIN_CONFIGURATION',
      nativeConfigurationKey: nextKey,
      changes: { modeIndex: 1 },
    });

    expect(next).toMatchObject({
      phase: 'configuring',
      modeIndex: 1,
      nativeConfigurationKey: nextKey,
      configurationGeneration: 1,
    });
  });

  it('atomically enters configuring when video aspect changes', () => {
    const videoKey = key({ mode: { mode: 'video' } });
    const nextKey = key({
      mode: { mode: 'video' },
      aspectRatio: '4:3',
    });
    const next = cameraSessionReducer(makeState(videoKey, { modeIndex: 1 }), {
      type: 'BEGIN_CONFIGURATION',
      nativeConfigurationKey: nextKey,
      changes: { aspectRatio: '4:3' },
    });

    expect(next).toMatchObject({
      phase: 'configuring',
      aspectRatio: '4:3',
      nativeConfigurationKey: nextKey,
      configurationGeneration: 1,
    });
  });

  it('atomically enters configuring when the actual device changes', () => {
    const nextKey = key({
      device: { id: 'dev-front', position: 'front' },
    });
    const next = cameraSessionReducer(makeState(), {
      type: 'BEGIN_CONFIGURATION',
      nativeConfigurationKey: nextKey,
      changes: { activePosition: 'front', canFlip: true },
    });

    expect(next).toMatchObject({
      phase: 'configuring',
      activePosition: 'front',
      canFlip: true,
      nativeConfigurationKey: nextKey,
      configurationGeneration: 1,
    });
  });

  it('restores flip availability through same-key inventory synchronization', () => {
    const front = device('front');
    const state = makeState(
      key({ device: { id: front.id, position: 'front' } }),
      {
        activePosition: 'front',
        canFlip: false,
      }
    );
    const selection = selectCameraDevice('front', device('back'), front);
    if (selection == null) throw new Error('expected front selection');

    const next = cameraSessionReducer(state, {
      type: 'BEGIN_CONFIGURATION',
      nativeConfigurationKey: state.nativeConfigurationKey,
      changes: {
        activePosition: selection.activePosition,
        canFlip: selection.canFlip,
      },
    });

    expect(next).toMatchObject({
      phase: 'ready',
      activePosition: 'front',
      canFlip: true,
      configurationGeneration: 0,
    });
  });

  it('synchronizes fallback actual position through configuration changes', () => {
    const front = device('front');
    const selection = selectCameraDevice('back', undefined, front);
    if (selection == null) throw new Error('expected fallback selection');
    const nextKey = key({
      device: {
        id: selection.device.id,
        position: selection.activePosition,
      },
    });

    const next = cameraSessionReducer(makeState(), {
      type: 'BEGIN_CONFIGURATION',
      nativeConfigurationKey: nextKey,
      changes: {
        activePosition: selection.activePosition,
        canFlip: selection.canFlip,
      },
    });

    expect(next).toMatchObject({
      phase: 'configuring',
      activePosition: 'front',
      canFlip: false,
      nativeConfigurationKey: nextKey,
      configurationGeneration: 1,
    });
  });

  it.each([
    ['device', key({ device: { id: 'front-1', position: 'front' } })],
    ['photo to video', key({ mode: { mode: 'video' } })],
    ['photo quality', key({ mode: { mode: 'single', quality: 0.8 } })],
    ['video aspect', key({ mode: { mode: 'video' }, aspectRatio: '4:3' })],
    [
      'video bitrate',
      key({ mode: { mode: 'video' }, videoBitRate: 20_000_000 }),
    ],
    ['HDR constraint', key({ photoHDR: true })],
    ['quality constraint', key({ photoQualityPrioritization: 'speed' })],
  ])('enters configuring for a real %s change', (_label, nextKey) => {
    const next = cameraSessionReducer(makeState(), {
      type: 'BEGIN_CONFIGURATION',
      nativeConfigurationKey: nextKey,
    });
    expect(next).toMatchObject({
      phase: 'configuring',
      nativeConfigurationKey: nextKey,
      configurationGeneration: 1,
    });
  });

  it('ignores stale configured callbacks after rapid native changes', () => {
    const first = cameraSessionReducer(makeState(), {
      type: 'BEGIN_CONFIGURATION',
      nativeConfigurationKey: key({
        device: { id: 'front-1', position: 'front' },
      }),
    });
    const second = cameraSessionReducer(first, {
      type: 'BEGIN_CONFIGURATION',
      nativeConfigurationKey: key({ mode: { mode: 'video' } }),
    });

    const stale = cameraSessionReducer(second, {
      type: 'CONFIGURED',
      generation: 1,
    });
    const current = cameraSessionReducer(stale, {
      type: 'CONFIGURED',
      generation: 2,
    });

    expect(stale).toBe(second);
    expect(current.phase).toBe('ready');
    expect(current.configurationGeneration).toBe(2);
  });
});
