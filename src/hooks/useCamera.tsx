import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { CameraApi, CameraResult, OpenConfig } from '../utils';
import { Container, ModalView } from '../camera';

export function useCamera(): [CameraApi, React.ReactElement] {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<OpenConfig | null>(null);
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
          resolverRef.current = resolve;
          setConfig(cfg);
          setVisible(true);
        }),
      close: () => settle({ code: 0, data: [], message: 'cancelled' }),
    }),
    [settle]
  );

  const holder = (
    <ModalView
      visible={visible}
      onClose={() => settle({ code: 0, data: [], message: 'cancelled' })}
    >
      {config && <Container config={config} onSettle={settle} />}
    </ModalView>
  );

  return [api, holder];
}
