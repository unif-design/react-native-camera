import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Button,
  ThemeProvider,
  r,
  rf,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';
import { useCamera, type CameraResult } from '@unif/react-native-camera';

function AppInner() {
  const [api, holder] = useCamera();
  const [lastResult, setLastResult] = useState<CameraResult | null>(null);
  const styles = useThemedStyles(makeStyles);

  const open = async (
    cameraMode: Parameters<typeof api.open>[0]['cameraMode']
  ) => {
    const result = await api.open({ cameraMode, dataRetainedMode: 'clear' });
    setLastResult(result);
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
        <Button
          variant="primary"
          label="单拍"
          onPress={() => open([{ mode: 'single', quality: 0.9 }])}
        />
        <Button
          variant="primary"
          label="连拍"
          onPress={() => open([{ mode: 'continuous', quality: 0.9 }])}
        />
        <Button
          variant="primary"
          label="视频"
          onPress={() => open([{ mode: 'video' }])}
        />
      </View>
      {holder}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppInner />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const makeStyles = (c: ColorTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    results: { flex: 1 },
    resultsContent: { padding: r(16) },
    h: { color: c.foreground, fontSize: rf(14), marginBottom: r(8) },
    code: {
      color: c.foregroundMuted,
      fontFamily: 'Menlo',
      fontSize: rf(11),
    },
    btnRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: r(16),
      backgroundColor: c.surfaceContainer,
      gap: r(8),
    },
  });
