import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useCamera, type CameraResult } from '@unif/react-native-camera';

export default function App() {
  const [api, holder] = useCamera();
  const [lastResult, setLastResult] = useState<CameraResult | null>(null);

  const open = async (
    cameraMode: Parameters<typeof api.open>[0]['cameraMode']
  ) => {
    const r = await api.open({ cameraMode, dataRetainedMode: 'clear' });
    setLastResult(r);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.results}
        contentContainerStyle={styles.resultsContent}
      >
        <Text style={styles.h}>上一次结果：</Text>
        <Text style={styles.code}>
          {lastResult ? JSON.stringify(lastResult, null, 2) : '无'}
        </Text>
      </ScrollView>
      <View style={styles.btnRow}>
        <TouchableOpacity
          style={styles.btn}
          onPress={() =>
            open([{ mode: 'single', photoQuality: 'speed', jpegQuality: 0.9 }])
          }
        >
          <Text style={styles.btnText}>单拍</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btn}
          onPress={() =>
            open([
              { mode: 'continuous', photoQuality: 'speed', jpegQuality: 0.9 },
            ])
          }
        >
          <Text style={styles.btnText}>连拍</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => open([{ mode: 'video' }])}
        >
          <Text style={styles.btnText}>视频</Text>
        </TouchableOpacity>
      </View>
      {holder}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#222' },
  results: { flex: 1 },
  resultsContent: { padding: 16 },
  h: { color: 'white', fontSize: 14, marginBottom: 8 },
  code: { color: '#9c9', fontFamily: 'Menlo', fontSize: 11 },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    backgroundColor: '#111',
  },
  btn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#3a3',
    borderRadius: 6,
  },
  btnText: { color: 'white', fontWeight: '600' },
});
