import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

// App 是否在前台(AppState === 'active')。对齐 vision-camera 官方 example 的 useIsActive:
// 相机 isActive 需随 App 前后台切换 gate —— 切后台时停取景(省电 + 释放摄像头),
// 回前台恢复。本库是弹窗相机,「屏幕聚焦」信号由 Modal 可见 + 非预览/烧录态在 Container 合成,
// 这里只负责前后台这一维。
export function useAppActive(): boolean {
  const [active, setActive] = useState(
    () => AppState.currentState === 'active'
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) =>
      setActive(state === 'active')
    );
    return () => sub.remove();
  }, []);

  return active;
}
