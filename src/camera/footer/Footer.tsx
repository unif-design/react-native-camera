import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { CameraMode } from '../../utils';

type Props = {
  modes: CameraMode[];
  currentIndex: number;
  recording: boolean;
  onShutter: () => void;
  onSelectMode: (i: number) => void;
  onCancel: () => void;
  onFinishBurst?: () => void;
  burstCount?: number;
};

const labelMap: Record<CameraMode['mode'], string> = {
  single: '拍照',
  continuous: '连拍',
  video: '视频',
};

export function Footer({
  modes,
  currentIndex,
  recording,
  onShutter,
  onSelectMode,
  onCancel,
  onFinishBurst,
  burstCount,
}: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.modesRow}>
        {modes.map((m, i) => (
          <TouchableOpacity
            key={m.mode + i}
            disabled={recording}
            onPress={() => onSelectMode(i)}
            testID={`mode-${m.mode}`}
          >
            <Text
              style={[styles.modeText, i === currentIndex && styles.modeActive]}
            >
              {labelMap[m.mode]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={onCancel}
          testID="cancel-btn"
          disabled={recording}
        >
          <Text style={styles.text}>取消</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onShutter}
          testID="shutter-btn"
          style={[styles.shutter, recording && styles.shutterRecording]}
        />
        {onFinishBurst && burstCount && burstCount > 0 ? (
          <TouchableOpacity onPress={onFinishBurst} testID="finish-burst-btn">
            <Text style={styles.text}>完成 ({burstCount})</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  modesRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  modeText: {
    color: '#bbb',
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modeActive: { color: 'white', fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    width: '100%',
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
  shutterRecording: { backgroundColor: 'red' },
  text: { color: 'white', fontSize: 14 },
  placeholder: { width: 60 },
});
