import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { cancelledResult } from '../../utils';
import type { CameraResult, CustomPhotoFile, FlashMode } from '../../utils';
import type {
  RegisterSessionController,
  SessionControllerBridge,
} from '../session/controllerBridge';
import { cameraSessionReducer, selectCapabilities } from '../session/reducer';
import type {
  CameraPreviewState,
  CameraSessionAction,
  CameraSessionState,
  ConfigurationChanges,
} from '../session/types';

export type CameraOperationToken = Readonly<{
  sessionId: number;
  operationId: number;
}>;

export type CameraSessionInitialState = Pick<
  CameraSessionState,
  | 'files'
  | 'modeIndex'
  | 'aspectRatio'
  | 'activePosition'
  | 'canFlip'
  | 'flash'
  | 'sound'
  | 'nativeConfigurationKey'
>;

type ConfirmOptions = {
  title: string;
  message?: string;
};

export type UseCameraSessionControllerParams = {
  sessionId: number;
  initialState: CameraSessionInitialState;
  registerController: RegisterSessionController;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  cancelRecording: () => void | Promise<void>;
  onSettle: (result: CameraResult) => void;
};

export type CameraSessionController = {
  state: CameraSessionState;
  capabilities: ReturnType<typeof selectCapabilities>;
  beginConfiguration: (
    nativeConfigurationKey: string,
    changes?: ConfigurationChanges,
    forceNativeReconfiguration?: boolean
  ) => number | null;
  configured: (generation: number) => boolean;
  setFlash: (flash: FlashMode) => boolean;
  setSound: (sound: boolean) => boolean;
  beginPhoto: () => CameraOperationToken | null;
  photoCaptured: (token: CameraOperationToken) => boolean;
  photoSucceeded: (
    token: CameraOperationToken,
    file: CustomPhotoFile,
    preview?: CameraPreviewState
  ) => boolean;
  beginVideo: () => CameraOperationToken | null;
  videoStarted: (token: CameraOperationToken) => boolean;
  videoProgress: (token: CameraOperationToken, duration: number) => boolean;
  stopVideo: (token: CameraOperationToken, duration: number) => boolean;
  videoFinished: (
    token: CameraOperationToken,
    result: {
      file?: CustomPhotoFile;
      duration: number;
      reason: string;
    }
  ) => boolean;
  isCurrent: (token: CameraOperationToken) => boolean;
  fail: (token: CameraOperationToken) => boolean;
  openPreview: (preview: CameraPreviewState) => boolean;
  closePreview: () => boolean;
  deleteFile: (path: string) => CustomPhotoFile | null;
  clearFiles: () => CustomPhotoFile[] | null;
  save: () => boolean;
  settle: (result: CameraResult) => boolean;
  requestUserCancel: () => void;
  forceTeardown: () => void;
};

type PendingCancelRequest = {
  id: number;
  phase: CameraSessionState['phase'];
  operationId: number | null;
};

const TRANSIENT_PHASES = new Set<CameraSessionState['phase']>([
  'capturingPhoto',
  'processingPhoto',
  'startingVideo',
  'stoppingVideo',
]);

const ACTIVE_VIDEO_PHASES = new Set<CameraSessionState['phase']>([
  'startingVideo',
  'recording',
  'stoppingVideo',
]);

function createInitialState(
  initialState: CameraSessionInitialState
): CameraSessionState {
  return {
    ...initialState,
    files: [...initialState.files],
    phase: 'configuring',
    preview: null,
    operationId: null,
    configurationGeneration: 0,
    video: { duration: 0, reason: null },
  };
}

export function useCameraSessionController({
  sessionId,
  initialState,
  registerController,
  confirm,
  cancelRecording,
  onSettle,
}: UseCameraSessionControllerParams): CameraSessionController {
  const initialStateRef = useRef<CameraSessionState | null>(null);
  if (initialStateRef.current == null) {
    initialStateRef.current = createInitialState(initialState);
  }

  const [state, dispatch] = useReducer(
    cameraSessionReducer,
    initialStateRef.current
  );
  // React dispatch 在同一 call stack 内尚未刷新；shadow 先同步推进，才能让第二次
  // 快门立即看到 capturing/starting phase，而不是再开一个 UHD operation。
  const stateRef = useRef(initialStateRef.current);
  const mountedRef = useRef(true);
  const nextOperationIdRef = useRef(1);
  const activeOperationRef = useRef<CameraOperationToken | null>(null);
  const nextCancelRequestIdRef = useRef(1);
  const pendingCancelRef = useRef<PendingCancelRequest | null>(null);
  const terminalOwnershipEpochRef = useRef(0);
  const settleNotifiedRef = useRef(false);
  const confirmRef = useRef(confirm);
  const cancelRecordingRef = useRef(cancelRecording);
  const onSettleRef = useRef(onSettle);
  confirmRef.current = confirm;
  cancelRecordingRef.current = cancelRecording;
  onSettleRef.current = onSettle;

  const apply = useCallback((action: CameraSessionAction): boolean => {
    const previous = stateRef.current;
    const next = cameraSessionReducer(previous, action);
    if (next === previous) return false;

    stateRef.current = next;
    if (
      next.phase !== previous.phase ||
      next.operationId !== previous.operationId
    ) {
      pendingCancelRef.current = null;
    }
    if (next.operationId == null) {
      activeOperationRef.current = null;
    }
    if (mountedRef.current) {
      dispatch(action);
    }
    return true;
  }, []);

  const isCurrent = useCallback(
    (token: CameraOperationToken): boolean => {
      const active = activeOperationRef.current;
      const current = stateRef.current;
      return (
        mountedRef.current &&
        active != null &&
        active.sessionId === token.sessionId &&
        active.operationId === token.operationId &&
        token.sessionId === sessionId &&
        current.operationId === token.operationId &&
        current.phase !== 'settling' &&
        current.phase !== 'closed'
      );
    },
    [sessionId]
  );

  const applyOperation = useCallback(
    (token: CameraOperationToken, action: CameraSessionAction): boolean => {
      if (!isCurrent(token)) return false;
      return apply(action);
    },
    [apply, isCurrent]
  );

  const beginOperation = useCallback(
    (type: 'CAPTURE_PHOTO' | 'START_VIDEO'): CameraOperationToken | null => {
      if (!mountedRef.current) return null;
      const operationId = nextOperationIdRef.current;
      const token = { sessionId, operationId };
      if (!apply({ type, operationId })) return null;
      nextOperationIdRef.current += 1;
      activeOperationRef.current = token;
      return token;
    },
    [apply, sessionId]
  );

  const beginConfiguration = useCallback(
    (
      nativeConfigurationKey: string,
      changes?: ConfigurationChanges,
      forceNativeReconfiguration = false
    ): number | null => {
      if (!mountedRef.current) return null;
      const phase = stateRef.current.phase;
      if (phase !== 'ready' && phase !== 'configuring') return null;
      apply({
        type: 'BEGIN_CONFIGURATION',
        nativeConfigurationKey,
        changes,
        forceNativeReconfiguration,
      });
      return stateRef.current.configurationGeneration;
    },
    [apply]
  );

  const configured = useCallback(
    (generation: number) =>
      mountedRef.current && apply({ type: 'CONFIGURED', generation }),
    [apply]
  );

  const setFlash = useCallback(
    (flash: FlashMode) =>
      mountedRef.current && apply({ type: 'SET_FLASH', flash }),
    [apply]
  );

  const setSound = useCallback(
    (sound: boolean) =>
      mountedRef.current && apply({ type: 'SET_SOUND', sound }),
    [apply]
  );

  const beginPhoto = useCallback(
    () => beginOperation('CAPTURE_PHOTO'),
    [beginOperation]
  );

  const photoCaptured = useCallback(
    (token: CameraOperationToken) =>
      applyOperation(token, {
        type: 'PHOTO_CAPTURED',
        operationId: token.operationId,
      }),
    [applyOperation]
  );

  const photoSucceeded = useCallback(
    (
      token: CameraOperationToken,
      file: CustomPhotoFile,
      preview?: CameraPreviewState
    ) =>
      applyOperation(token, {
        type: 'PHOTO_SUCCEEDED',
        operationId: token.operationId,
        file,
        preview,
      }),
    [applyOperation]
  );

  const beginVideo = useCallback(
    () => beginOperation('START_VIDEO'),
    [beginOperation]
  );

  const videoStarted = useCallback(
    (token: CameraOperationToken) =>
      applyOperation(token, {
        type: 'VIDEO_STARTED',
        operationId: token.operationId,
      }),
    [applyOperation]
  );

  const videoProgress = useCallback(
    (token: CameraOperationToken, duration: number) =>
      applyOperation(token, {
        type: 'VIDEO_PROGRESS',
        operationId: token.operationId,
        duration,
      }),
    [applyOperation]
  );

  const stopVideo = useCallback(
    (token: CameraOperationToken, duration: number) =>
      applyOperation(token, {
        type: 'STOP_VIDEO',
        operationId: token.operationId,
        duration,
      }),
    [applyOperation]
  );

  const videoFinished = useCallback(
    (
      token: CameraOperationToken,
      result: {
        file?: CustomPhotoFile;
        duration: number;
        reason: string;
      }
    ) =>
      applyOperation(token, {
        type: 'VIDEO_FINISHED',
        operationId: token.operationId,
        ...result,
      }),
    [applyOperation]
  );

  const fail = useCallback(
    (token: CameraOperationToken) =>
      applyOperation(token, {
        type: 'OPERATION_FAILED',
        operationId: token.operationId,
      }),
    [applyOperation]
  );

  const openPreview = useCallback(
    (preview: CameraPreviewState) =>
      mountedRef.current && apply({ type: 'OPEN_PREVIEW', preview }),
    [apply]
  );

  const closePreview = useCallback(
    () => mountedRef.current && apply({ type: 'CLOSE_PREVIEW' }),
    [apply]
  );

  const deleteFile = useCallback(
    (path: string): CustomPhotoFile | null => {
      if (!mountedRef.current || stateRef.current.phase !== 'previewing') {
        return null;
      }
      const file = stateRef.current.files.find(
        (candidate) => candidate.path === path
      );
      if (file == null || !apply({ type: 'DELETE_FILE', path })) return null;
      return file;
    },
    [apply]
  );

  const clearFiles = useCallback((): CustomPhotoFile[] | null => {
    if (
      !mountedRef.current ||
      (stateRef.current.phase !== 'ready' &&
        stateRef.current.phase !== 'previewing')
    ) {
      return null;
    }
    const files = [...stateRef.current.files];
    apply({ type: 'CLEAR_FILES' });
    return files;
  }, [apply]);

  const notifySettle = useCallback((result: CameraResult): boolean => {
    if (settleNotifiedRef.current) return false;
    settleNotifiedRef.current = true;
    onSettleRef.current(result);
    return true;
  }, []);

  const settle = useCallback(
    (result: CameraResult): boolean => {
      if (!mountedRef.current || !apply({ type: 'SETTLING' })) return false;
      notifySettle(result);
      return true;
    },
    [apply, notifySettle]
  );

  const save = useCallback((): boolean => {
    const current = stateRef.current;
    if (!mountedRef.current || !selectCapabilities(current).save) return false;
    return settle({
      code: 200,
      data: [...current.files],
      message: 'ok',
    });
  }, [settle]);

  const cancelRecordingBestEffort = useCallback(async (): Promise<void> => {
    try {
      await cancelRecordingRef.current();
    } catch (error) {
      console.warn('camera recording cancellation failed', error);
    }
  }, []);

  const cancelRequestIsCurrent = useCallback(
    (request: PendingCancelRequest): boolean => {
      const current = stateRef.current;
      return (
        pendingCancelRef.current === request &&
        mountedRef.current &&
        current.phase === request.phase &&
        current.operationId === request.operationId
      );
    },
    []
  );

  const confirmUserCancel = useCallback(
    async (
      request: PendingCancelRequest,
      options: ConfirmOptions,
      cancelActiveRecording: boolean
    ): Promise<void> => {
      let approved: boolean;
      try {
        approved = await confirmRef.current(options);
      } catch (error) {
        if (cancelRequestIsCurrent(request)) {
          pendingCancelRef.current = null;
          console.warn('camera cancel confirmation failed', error);
        }
        return;
      }

      if (!cancelRequestIsCurrent(request)) return;
      pendingCancelRef.current = null;
      if (!approved) return;

      if (!cancelActiveRecording) {
        settle(cancelledResult());
        return;
      }

      // 先失效 operation token，再碰 native；cancel 同步回调的 finished/error
      // 因而只能成为 stale event，不能在取消已确认后把视频重新提交进 files。
      if (!apply({ type: 'SETTLING' })) return;
      const ownerEpoch = ++terminalOwnershipEpochRef.current;
      await cancelRecordingBestEffort();
      if (
        !mountedRef.current ||
        terminalOwnershipEpochRef.current !== ownerEpoch
      ) {
        return;
      }
      terminalOwnershipEpochRef.current += 1;
      notifySettle(cancelledResult());
    },
    [
      apply,
      cancelRecordingBestEffort,
      cancelRequestIsCurrent,
      notifySettle,
      settle,
    ]
  );

  const requestUserCancel = useCallback((): void => {
    if (!mountedRef.current || pendingCancelRef.current != null) return;
    const current = stateRef.current;
    if (
      TRANSIENT_PHASES.has(current.phase) ||
      current.phase === 'settling' ||
      current.phase === 'closed'
    ) {
      return;
    }

    if (current.phase === 'recording') {
      const request = {
        id: nextCancelRequestIdRef.current++,
        phase: current.phase,
        operationId: current.operationId,
      };
      pendingCancelRef.current = request;
      confirmUserCancel(
        request,
        {
          title: '放弃录制',
          message: '正在录像,是否放弃本次拍摄?',
        },
        true
      ).catch((error) => {
        console.warn('camera user cancellation failed', error);
      });
      return;
    }

    if (
      current.phase !== 'configuring' &&
      current.phase !== 'ready' &&
      current.phase !== 'previewing'
    ) {
      return;
    }

    if (current.files.length === 0) {
      settle(cancelledResult());
      return;
    }

    const request = {
      id: nextCancelRequestIdRef.current++,
      phase: current.phase,
      operationId: current.operationId,
    };
    pendingCancelRef.current = request;
    confirmUserCancel(
      request,
      {
        title: '放弃拍摄',
        message: `放弃已拍 ${current.files.length} 张?`,
      },
      false
    ).catch((error) => {
      console.warn('camera user cancellation failed', error);
    });
  }, [confirmUserCancel, settle]);

  const forceTeardown = useCallback((): void => {
    // reducer 可能已由 user-cancel 置为 settling；epoch 必须先失效，确保其 await
    // continuation 不会在 coordinator 接管结果后再发一次 stale onSettle。
    terminalOwnershipEpochRef.current += 1;
    pendingCancelRef.current = null;
    activeOperationRef.current = null;
    const current = stateRef.current;
    const cancelActiveRecording = ACTIVE_VIDEO_PHASES.has(current.phase);
    if (!apply({ type: 'SETTLING' })) return;
    if (cancelActiveRecording) {
      cancelRecordingBestEffort().catch((error) => {
        console.warn('camera force teardown failed', error);
      });
    }
  }, [apply, cancelRecordingBestEffort]);

  const requestUserCancelRef = useRef(requestUserCancel);
  const forceTeardownRef = useRef(forceTeardown);
  requestUserCancelRef.current = requestUserCancel;
  forceTeardownRef.current = forceTeardown;
  const bridge = useMemo<SessionControllerBridge>(
    () => ({
      requestUserCancel: () => requestUserCancelRef.current(),
      forceTeardown: () => forceTeardownRef.current(),
    }),
    []
  );

  useEffect(() => {
    mountedRef.current = true;
    const unregister = registerController(sessionId, bridge);
    return () => {
      mountedRef.current = false;
      terminalOwnershipEpochRef.current += 1;
      // effect cleanup 只注销并使 async continuation 过期；真正的 native teardown
      // 仍由 coordinator 在 real unmount/supersede 时通过保留的 bridge 发起。
      activeOperationRef.current = null;
      pendingCancelRef.current = null;
      unregister();
    };
  }, [bridge, registerController, sessionId]);

  return {
    state,
    capabilities: selectCapabilities(state),
    beginConfiguration,
    configured,
    setFlash,
    setSound,
    beginPhoto,
    photoCaptured,
    photoSucceeded,
    beginVideo,
    videoStarted,
    videoProgress,
    stopVideo,
    videoFinished,
    isCurrent,
    fail,
    openPreview,
    closePreview,
    deleteFile,
    clearFiles,
    save,
    settle,
    requestUserCancel,
    forceTeardown,
  };
}
