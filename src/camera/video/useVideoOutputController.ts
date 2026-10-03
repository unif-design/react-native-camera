import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useMicrophonePermission,
  useVideoOutput,
  type CameraVideoOutput,
  type RecorderSettings,
  type VideoOutputOptions,
} from 'react-native-vision-camera';
import {
  createRecorderController,
  type RecorderController,
} from '../recording/recorderController';

const CONFIGURATION_TIMEOUT_MS = 10000;

interface ConfigurationWaiter {
  accept(output: CameraVideoOutput): void;
  reject(error: Error): void;
}

/** Preview does not require audio. An explicit recording waits for authorized,
 * configured audio output before creating its native recorder. */
export function useVideoOutputController(
  options: Pick<VideoOutputOptions, 'targetResolution' | 'targetBitRate'>
) {
  const { hasPermission, requestPermission } = useMicrophonePermission();
  const [configurationRevision, setConfigurationRevision] = useState(0);
  const requestedRevision = useRef(0);
  const configurationFailed = useRef(false);
  // A failed native configuration needs a fresh output on the next explicit attempt.
  const targetResolution = useMemo(
    () =>
      configurationRevision === 0
        ? options.targetResolution
        : { ...options.targetResolution },
    [configurationRevision, options.targetResolution]
  );
  const output = useVideoOutput({
    ...options,
    targetResolution,
    enableAudio: hasPermission,
    fileType: 'mp4',
  });
  const current = useRef({ output, hasPermission });
  current.current = { output, hasPermission };
  const configuredOutput = useRef<CameraVideoOutput | null>(null);
  const waiters = useRef(new Set<ConfigurationWaiter>());

  const createRecorder = useCallback(
    async (settings: RecorderSettings, signal: AbortSignal) => {
      if (configurationFailed.current && !signal.aborted) {
        configurationFailed.current = false;
        configuredOutput.current = null;
        requestedRevision.current += 1;
        setConfigurationRevision(requestedRevision.current);
      }
      const configured = await new Promise<CameraVideoOutput>(
        (resolve, reject) => {
          if (signal.aborted) {
            reject(new Error('Video preparation cancelled'));
            return;
          }
          const latest = current.current;
          if (
            latest.hasPermission &&
            configuredOutput.current === latest.output
          ) {
            resolve(latest.output);
            return;
          }
          const cleanup = () => {
            clearTimeout(timer);
            signal.removeEventListener('abort', abort);
            waiters.current.delete(waiter);
          };
          const waiter: ConfigurationWaiter = {
            accept: (ready) => {
              cleanup();
              resolve(ready);
            },
            reject: (error) => {
              cleanup();
              reject(error);
            },
          };
          const abort = () =>
            waiter.reject(new Error('Video preparation cancelled'));
          const timer = setTimeout(() => {
            configurationFailed.current = true;
            waiter.reject(new Error('Audio output configuration timed out'));
          }, CONFIGURATION_TIMEOUT_MS);
          waiters.current.add(waiter);
          signal.addEventListener('abort', abort, { once: true });
        }
      );
      if (signal.aborted) throw new Error('Video preparation cancelled');
      return configured.createRecorder(settings);
    },
    []
  );
  const owner = useRef<{
    output: CameraVideoOutput;
    hasPermission: boolean;
    revision: number;
    options: typeof options;
    controller: RecorderController;
  } | null>(null);
  const controller = useMemo(() => {
    const prior = owner.current;
    const sameSettings =
      prior?.options.targetResolution === options.targetResolution &&
      prior.options.targetBitRate === options.targetBitRate;
    // Only the deliberate permission/retry output swap may keep the original attempt.
    // Any other native output replacement permanently invalidates its old controller.
    const keepOwner =
      prior != null &&
      sameSettings &&
      (prior.output === output ||
        (!prior.hasPermission && hasPermission) ||
        prior.revision !== configurationRevision);
    const next = keepOwner
      ? prior.controller
      : createRecorderController({ createRecorder });
    owner.current = {
      output,
      hasPermission,
      revision: configurationRevision,
      options: {
        targetResolution: options.targetResolution,
        targetBitRate: options.targetBitRate,
      },
      controller: next,
    };
    return next;
  }, [
    configurationRevision,
    createRecorder,
    hasPermission,
    options.targetBitRate,
    options.targetResolution,
    output,
  ]);
  useEffect(() => {
    controller.activate();
    return () => {
      controller.dispose().catch(() => {});
    };
  }, [controller]);

  const onConfigured = useCallback(() => {
    if (
      current.current.output !== output ||
      requestedRevision.current !== configurationRevision
    )
      return;
    configuredOutput.current = output;
    configurationFailed.current = false;
    if (current.current.hasPermission) {
      for (const waiter of [...waiters.current]) waiter.accept(output);
    }
  }, [configurationRevision, output]);
  const onError = useCallback(
    (error: Error) => {
      if (
        current.current.output !== output ||
        requestedRevision.current !== configurationRevision
      )
        return;
      configuredOutput.current = null;
      configurationFailed.current = true;
      for (const waiter of [...waiters.current]) waiter.reject(error);
    },
    [configurationRevision, output]
  );

  return {
    output,
    controller,
    hasPermission,
    requestPermission,
    onConfigured,
    onError,
  };
}
