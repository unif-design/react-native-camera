import { useEffect, useMemo, type ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@unif/react-native-design';
import { useCamera } from '@unif/react-native-camera';

import { ShowcaseApp } from './app/ShowcaseApp';
import { createCameraRunController } from './domain/cameraRun';

let runSequence = 0;

const systemNow = (): Date => new Date();
const nextRunId = (): string => `run-${++runSequence}`;

function CameraShowcase(): ReactElement {
  const [api, holder] = useCamera();
  const run = useMemo(
    () =>
      createCameraRunController({
        api,
        now: systemNow,
        nextId: nextRunId,
      }),
    [api]
  );

  useEffect(
    () => () => {
      api.close();
    },
    [api]
  );

  return (
    <>
      <ShowcaseApp run={run} />
      {holder}
    </>
  );
}

export default function App(): ReactElement {
  return (
    <GestureHandlerRootView style={rootStyles.root}>
      <ThemeProvider>
        <SafeAreaProvider>
          <CameraShowcase />
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const rootStyles = StyleSheet.create({
  root: { flex: 1 },
});
