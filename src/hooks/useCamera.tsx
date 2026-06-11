import React, { useCallback, useMemo, useRef, useState } from 'react';
import { cancelledResult } from '../utils';
import type { CameraApi, CameraResult, OpenConfig } from '../utils';
import { Container, ModalView } from '../camera';

export function useCamera(): [CameraApi, React.ReactElement] {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<OpenConfig | null>(null);
  // 会话序号:每次 open 自增,作 Container 的 key → 二次 open 时 Container remount,
  // 旧会话的 photos / mode / zoom 等状态不串进新会话。
  const [sessionId, setSessionId] = useState(0);
  const resolverRef = useRef<((r: CameraResult) => void) | null>(null);

  const settle = useCallback((r: CameraResult) => {
    if (resolverRef.current) {
      resolverRef.current(r);
      resolverRef.current = null;
    }
    setVisible(false);
    setConfig(null);
  }, []);

  const api = useMemo<CameraApi>(
    () => ({
      open: (cfg: OpenConfig) =>
        new Promise<CameraResult>((resolve) => {
          // 已打开时再 open:先把旧会话 settle 取消 —— 否则旧 resolver 被覆盖、第一个 Promise
          // 永不兑现,消费者 await 挂死。随后 sessionId++ 让 Container remount(状态不串场)。
          if (resolverRef.current) resolverRef.current(cancelledResult());
          resolverRef.current = resolve;
          setSessionId((n) => n + 1);
          setConfig(cfg);
          setVisible(true);
        }),
      close: () => settle(cancelledResult()),
    }),
    [settle]
  );

  const holder = (
    <ModalView visible={visible} onClose={() => settle(cancelledResult())}>
      {config && (
        <Container key={sessionId} config={config} onSettle={settle} />
      )}
    </ModalView>
  );

  return [api, holder];
}
