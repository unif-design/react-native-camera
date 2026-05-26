import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import {
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import type { CameraResult, CustomPhotoFile, OpenConfig } from '../utils';
import { NoCamera } from './NoCamera';
import { NoPermission } from './NoPermission';
import { Loading } from '../components/Loading';
import { Camera, type CameraHandle } from './Camera';
import { PreViewContainer } from './preview';
import { Footer } from './footer';

type Props = {
  config: OpenConfig;
  onSettle: (r: CameraResult) => void;
};

type PermissionState = 'pending' | 'granted' | 'denied';

export function Container({ config, onSettle }: Props) {
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

  // 5.x：physicalDevices 字符串不带 -camera；单 'wide-angle' 规避 iOS #3773
  const device = useCameraDevice('back', {
    physicalDevices: ['wide-angle'],
  });

  const cameraRef = useRef<CameraHandle>(null);
  const [photos, setPhotos] = useState<CustomPhotoFile[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [modeIndex, setModeIndex] = useState(0);
  const currentMode = config.cameraMode[modeIndex];

  const onShutter = async () => {
    if (currentMode?.mode === 'video') {
      if (!recording) {
        await cameraRef.current?.startVideo();
        setRecording(true);
      } else {
        const f = await cameraRef.current?.stopVideo();
        setRecording(false);
        if (f) {
          setPhotos([f]);
          setPreviewing(true);
        } else {
          onSettle({ code: 503, data: [], message: 'video_failed' });
        }
      }
      return;
    }
    const f = await cameraRef.current?.capture();
    if (!f) {
      onSettle({ code: 500, data: photos, message: 'capture_failed' });
      return;
    }
    setPhotos((prev) => [...prev, f]);
    if (currentMode?.mode !== 'continuous') {
      setPreviewing(true);
    }
  };

  if (state === 'denied') {
    return (
      <NoPermission
        onCancel={() =>
          onSettle({ code: 403, data: [], message: 'permission_denied' })
        }
        onOpenSettings={() => Linking.openSettings()}
      />
    );
  }

  if (state === 'pending') {
    return (
      <View style={styles.root} testID="permission-pending">
        <Loading />
      </View>
    );
  }

  if (previewing) {
    return (
      <PreViewContainer
        files={photos}
        onRetake={() => {
          setPhotos([]);
          setPreviewing(false);
        }}
        onConfirm={() => onSettle({ code: 200, data: photos, message: 'ok' })}
      />
    );
  }

  if (device == null) {
    return (
      <NoCamera
        onCancel={() => onSettle({ code: 404, data: [], message: 'no_device' })}
      />
    );
  }

  if (currentMode == null) {
    return (
      <NoCamera
        onCancel={() =>
          onSettle({ code: 500, data: [], message: 'invalid_config' })
        }
      />
    );
  }

  return (
    <View style={styles.root} testID="device-ready">
      <Camera ref={cameraRef} device={device} currentMode={currentMode} />
      <Footer
        modes={config.cameraMode}
        currentIndex={modeIndex}
        recording={recording}
        onShutter={onShutter}
        onSelectMode={(i) => {
          if (config.dataRetainedMode === 'clear') setPhotos([]);
          setModeIndex(i);
        }}
        onCancel={() => onSettle({ code: 0, data: [], message: 'cancelled' })}
        onFinishBurst={
          currentMode?.mode === 'continuous'
            ? () => setPreviewing(true)
            : undefined
        }
        burstCount={
          currentMode?.mode === 'continuous' ? photos.length : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
