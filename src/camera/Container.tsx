import { useEffect, useRef, useState } from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
  const currentMode = config.cameraMode[0];
  const isContinuous = currentMode?.mode === 'continuous';
  const isVideo = currentMode?.mode === 'video';

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
      <View style={styles.bottomBar}>
        <TouchableOpacity
          testID="cancel-btn"
          onPress={() => onSettle({ code: 0, data: [], message: 'cancelled' })}
        >
          <Text style={styles.text}>取消</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="shutter-btn"
          onPress={async () => {
            if (isVideo) {
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
              onSettle({
                code: 500,
                data: photos,
                message: 'capture_failed',
              });
              return;
            }
            setPhotos((prev) => [...prev, f]);
            if (!isContinuous) {
              setPreviewing(true);
            }
          }}
          style={[styles.shutter, recording && styles.shutterRecording]}
        />
        {isContinuous && photos.length > 0 && (
          <TouchableOpacity
            testID="finish-burst"
            onPress={() => setPreviewing(true)}
          >
            <Text style={styles.text}>完成 ({photos.length})</Text>
          </TouchableOpacity>
        )}
        {!isContinuous && (
          <TouchableOpacity
            testID="done-btn"
            onPress={() => onSettle({ code: 200, data: photos, message: 'ok' })}
          >
            <Text style={styles.text}>完成</Text>
          </TouchableOpacity>
        )}
      </View>
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
  bottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  shutter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'white',
    borderWidth: 4,
    borderColor: '#ddd',
  },
  shutterRecording: {
    backgroundColor: 'red',
  },
  text: {
    color: 'white',
    fontSize: 16,
  },
});
