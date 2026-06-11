import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { CustomPhotoFile } from '../../utils';
import type { CameraHandle } from '../Camera';

export type VideoRecorder = {
  recording: boolean;
  recSeconds: number;
  /** 开始录制:调 cameraRef.startVideo()。成功置 recording 返 true;失败不置 recording 返 false(调用方弹错误条、不关相机)。 */
  startRecording: () => Promise<boolean>;
  /**
   * 停止录制:调 cameraRef.stopVideo() 并清 recording,**返回拿到的 file**(可能 null)
   * 让调用方编排(有 file 则加 photos,否则 settle 503)。
   */
  stopRecording: () => Promise<CustomPhotoFile | null>;
  /** 录像被原生侧自行结束(maxDuration 到点/磁盘满/中断)时复位录制状态(文件由调用方入 photos)。 */
  markStopped: () => void;
};

/**
 * 录像状态机:recording + recSeconds 秒表。只管录制状态,
 * 「stop 后有 file 加 photos / 无 file settle 503」的编排留在调用方。
 */
export function useVideoRecorder(
  cameraRef: RefObject<CameraHandle | null>
): VideoRecorder {
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);

  useEffect(() => {
    if (!recording) {
      setRecSeconds(0);
      return;
    }
    const id = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      await cameraRef.current?.startVideo();
      setRecording(true);
      return true;
    } catch {
      // 启动失败:不进假录制态(不置 recording),返 false 让调用方弹错误条、不关相机丢已拍(P1#1b)。
      return false;
    }
  }, [cameraRef]);

  const stopRecording = useCallback(async () => {
    const f = (await cameraRef.current?.stopVideo()) ?? null;
    setRecording(false);
    return f;
  }, [cameraRef]);

  // 原生侧自发结束(maxDuration 到点/磁盘满/中断):仅复位录制状态,文件由调用方(useCaptureFlow)入 photos。
  const markStopped = useCallback(() => setRecording(false), []);

  return {
    recording,
    recSeconds,
    startRecording,
    stopRecording,
    markStopped,
  };
}
