import type {
  CameraSessionAction,
  CameraSessionCapabilities,
  CameraSessionState,
  ConfigurationChanges,
} from './types';

const NO_CAPABILITIES: CameraSessionCapabilities = {
  capture: false,
  flip: false,
  mode: false,
  aspect: false,
  save: false,
  gallery: false,
  zoom: false,
  focus: false,
  userCancel: false,
};

export function selectCapabilities(
  state: CameraSessionState
): CameraSessionCapabilities {
  switch (state.phase) {
    case 'configuring':
      return { ...NO_CAPABILITIES, userCancel: true };
    case 'ready': {
      const hasFiles = state.files.length > 0;
      return {
        capture: true,
        flip: state.canFlip,
        mode: true,
        aspect: true,
        save: hasFiles,
        gallery: hasFiles,
        zoom: true,
        focus: true,
        userCancel: true,
      };
    }
    case 'recording':
      return {
        ...NO_CAPABILITIES,
        capture: true,
        zoom: true,
        focus: true,
        userCancel: true,
      };
    case 'previewing':
      return {
        ...NO_CAPABILITIES,
        save: true,
        gallery: true,
        userCancel: true,
      };
    case 'capturingPhoto':
    case 'processingPhoto':
    case 'startingVideo':
    case 'stoppingVideo':
    case 'settling':
    case 'closed':
      return NO_CAPABILITIES;
  }
}

function sameOperation(
  state: CameraSessionState,
  operationId: number
): boolean {
  return state.operationId === operationId;
}

function applyConfigurationChanges(
  state: CameraSessionState,
  changes: ConfigurationChanges | undefined
): CameraSessionState {
  if (changes == null) return state;

  const changed =
    (changes.modeIndex !== undefined &&
      changes.modeIndex !== state.modeIndex) ||
    (changes.aspectRatio !== undefined &&
      changes.aspectRatio !== state.aspectRatio) ||
    (changes.activePosition !== undefined &&
      changes.activePosition !== state.activePosition) ||
    (changes.canFlip !== undefined && changes.canFlip !== state.canFlip);

  return changed ? { ...state, ...changes } : state;
}

export function cameraSessionReducer(
  state: CameraSessionState,
  action: CameraSessionAction
): CameraSessionState {
  if (action.type === 'SETTLING') {
    if (state.phase === 'settling' || state.phase === 'closed') return state;
    return {
      ...state,
      phase: 'settling',
      preview: null,
      operationId: null,
    };
  }

  if (action.type === 'CLOSED') {
    return state.phase === 'settling' ? { ...state, phase: 'closed' } : state;
  }

  if (state.phase === 'settling' || state.phase === 'closed') return state;

  if (action.type === 'BEGIN_CONFIGURATION') {
    if (state.phase !== 'ready' && state.phase !== 'configuring') return state;

    const changedState = applyConfigurationChanges(state, action.changes);
    if (action.nativeConfigurationKey === state.nativeConfigurationKey) {
      return changedState;
    }

    return {
      ...changedState,
      phase: 'configuring',
      operationId: null,
      nativeConfigurationKey: action.nativeConfigurationKey,
      configurationGeneration: state.configurationGeneration + 1,
    };
  }

  if (action.type === 'CONFIGURED') {
    if (
      state.phase !== 'configuring' ||
      action.generation !== state.configurationGeneration
    ) {
      return state;
    }
    return { ...state, phase: 'ready' };
  }

  const capabilities = selectCapabilities(state);

  switch (action.type) {
    case 'SET_FLASH':
      if (state.phase !== 'ready' || action.flash === state.flash) return state;
      return { ...state, flash: action.flash };
    case 'SET_SOUND':
      if (state.phase !== 'ready' || action.sound === state.sound) return state;
      return { ...state, sound: action.sound };
    case 'CAPTURE_PHOTO':
      if (!capabilities.capture || state.phase !== 'ready') return state;
      return {
        ...state,
        phase: 'capturingPhoto',
        operationId: action.operationId,
      };
    case 'PHOTO_CAPTURED':
      if (
        state.phase !== 'capturingPhoto' ||
        !sameOperation(state, action.operationId)
      ) {
        return state;
      }
      return { ...state, phase: 'processingPhoto' };
    case 'PHOTO_SUCCEEDED':
      if (
        state.phase !== 'processingPhoto' ||
        !sameOperation(state, action.operationId)
      ) {
        return state;
      }
      return {
        ...state,
        phase: action.preview == null ? 'ready' : 'previewing',
        files: [...state.files, action.file],
        preview: action.preview ?? null,
        operationId: null,
      };
    case 'START_VIDEO':
      if (!capabilities.capture || state.phase !== 'ready') return state;
      return {
        ...state,
        phase: 'startingVideo',
        operationId: action.operationId,
        video: { duration: 0, reason: null },
      };
    case 'VIDEO_STARTED':
      if (
        state.phase !== 'startingVideo' ||
        !sameOperation(state, action.operationId)
      ) {
        return state;
      }
      return { ...state, phase: 'recording' };
    case 'VIDEO_PROGRESS':
      if (
        (state.phase !== 'recording' && state.phase !== 'stoppingVideo') ||
        !sameOperation(state, action.operationId)
      ) {
        return state;
      }
      return {
        ...state,
        video: { ...state.video, duration: action.duration },
      };
    case 'STOP_VIDEO':
      if (
        state.phase !== 'recording' ||
        !sameOperation(state, action.operationId)
      ) {
        return state;
      }
      return {
        ...state,
        phase: 'stoppingVideo',
        video: { ...state.video, duration: action.duration },
      };
    case 'VIDEO_FINISHED':
      if (
        (state.phase !== 'startingVideo' &&
          state.phase !== 'recording' &&
          state.phase !== 'stoppingVideo') ||
        !sameOperation(state, action.operationId)
      ) {
        return state;
      }
      return {
        ...state,
        phase: 'ready',
        files:
          action.file == null ? state.files : [...state.files, action.file],
        operationId: null,
        video: { duration: action.duration, reason: action.reason },
      };
    case 'OPERATION_FAILED':
      if (
        !sameOperation(state, action.operationId) ||
        (state.phase !== 'capturingPhoto' &&
          state.phase !== 'processingPhoto' &&
          state.phase !== 'startingVideo' &&
          state.phase !== 'recording' &&
          state.phase !== 'stoppingVideo')
      ) {
        return state;
      }
      return {
        ...state,
        phase: 'ready',
        operationId: null,
        video: { duration: 0, reason: null },
      };
    case 'OPEN_PREVIEW':
      if (
        !capabilities.gallery ||
        action.preview.index < 0 ||
        action.preview.index >= state.files.length
      ) {
        return state;
      }
      return { ...state, phase: 'previewing', preview: action.preview };
    case 'CLOSE_PREVIEW':
      if (state.phase !== 'previewing') return state;
      return { ...state, phase: 'ready', preview: null };
    default:
      return state;
  }
}
