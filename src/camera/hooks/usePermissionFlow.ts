import { useEffect, useState } from 'react';
import { useCameraPermission } from 'react-native-vision-camera';

export type PermissionState = 'pending' | 'granted' | 'denied';

/**
 * 相机权限请求流:封装 useCameraPermission + 状态机 + 进入即请求的 effect。
 * 'pending'(请求中)→ 'granted' / 'denied'。无入参。
 */
export function usePermissionFlow(): PermissionState {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [state, setState] = useState<PermissionState>(
    hasPermission ? 'granted' : 'pending'
  );

  useEffect(() => {
    if (hasPermission) {
      setState('granted');
      return;
    }
    let cancelled = false;
    // 5.x：Android 并行 requestPermission 调用会 leak coroutine（issue #3834），
    //      必须 .catch(() => {}) 兜底；依赖 hasPermission 作为 source of truth
    requestPermission()
      .then((ok) => {
        if (cancelled) return;
        setState(ok ? 'granted' : 'denied');
      })
      .catch(() => {
        if (cancelled) return;
        setState('denied');
      });
    return () => {
      cancelled = true;
    };
  }, [hasPermission, requestPermission]);

  return state;
}
