import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Modal, View } from 'react-native';
import type { CameraApi, CameraResult, OpenConfig } from '../utils';

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
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => settle({ code: 0, data: [], message: 'cancelled' })}
      testID="camera-modal"
    >
      <View testID="camera-host" style={{ flex: 1 }}>
        {/* 后续 Task 接入 Container */}
      </View>
    </Modal>
  );

  // 在 config 上消除 unused 警告（后续 Task 用）
  void config;

  return [api, holder];
}
