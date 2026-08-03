import { useReducer, type ReactElement } from 'react';

import type { CameraRunController } from '../domain/cameraRun';
import {
  navigationReducer,
  type NavigationState,
  type ShowcaseRoute,
} from '../navigation/localNavigation';
import { BasicCaptureScreen } from '../screens/BasicCaptureScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MultiModeScreen } from '../screens/MultiModeScreen';
import { QualityLabScreen } from '../screens/QualityLabScreen';
import { WatermarkEvidenceScreen } from '../screens/WatermarkEvidenceScreen';

export type ShowcaseAppProps = {
  run: CameraRunController;
  now?: () => Date;
};

const initialNavigationState: NavigationState = {
  stack: [{ name: 'home' }],
};

const systemNow = (): Date => new Date();

export function ShowcaseApp({
  run,
  now = systemNow,
}: ShowcaseAppProps): ReactElement {
  const [navigation, dispatch] = useReducer(
    navigationReducer,
    initialNavigationState
  );
  const route =
    navigation.stack[navigation.stack.length - 1] ??
    initialNavigationState.stack[0]!;
  const onBack = (): void => {
    dispatch({ type: 'back' });
  };
  const onNavigate = (nextRoute: ShowcaseRoute): void => {
    dispatch({ type: 'push', route: nextRoute });
  };

  switch (route.name) {
    case 'home':
      return <HomeScreen run={run} onNavigate={onNavigate} />;
    case 'basic-capture':
      return <BasicCaptureScreen run={run} onBack={onBack} />;
    case 'multi-mode':
      return <MultiModeScreen run={run} onBack={onBack} />;
    case 'watermark-evidence':
      return <WatermarkEvidenceScreen run={run} now={now} onBack={onBack} />;
    case 'quality-lab':
      return <QualityLabScreen run={run} onBack={onBack} />;
    default: {
      const exhaustiveRoute: never = route;
      return exhaustiveRoute;
    }
  }
}
