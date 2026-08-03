import { useReducer, useState, type ReactElement } from 'react';

import type { CameraRunController } from '../domain/cameraRun';
import {
  navigationReducer,
  type NavigationState,
  type ShowcaseRoute,
} from '../navigation/localNavigation';
import {
  BasicCaptureScreen,
  initialBasicCaptureDraft,
} from '../screens/BasicCaptureScreen';
import { HomeScreen } from '../screens/HomeScreen';
import {
  initialMultiModeDraft,
  MultiModeScreen,
} from '../screens/MultiModeScreen';
import {
  initialQualityLabDraft,
  QualityLabScreen,
} from '../screens/QualityLabScreen';
import {
  initialWatermarkEvidenceDraft,
  WatermarkEvidenceScreen,
} from '../screens/WatermarkEvidenceScreen';

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
  const [watermarkDraft, setWatermarkDraft] = useState(
    initialWatermarkEvidenceDraft
  );
  const [qualityDraft, setQualityDraft] = useState(initialQualityLabDraft);
  const [basicDraft, setBasicDraft] = useState(initialBasicCaptureDraft);
  const [multiDraft, setMultiDraft] = useState(initialMultiModeDraft);
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
      return (
        <BasicCaptureScreen
          run={run}
          draft={basicDraft}
          onDraftChange={setBasicDraft}
          onBack={onBack}
        />
      );
    case 'multi-mode':
      return (
        <MultiModeScreen
          run={run}
          draft={multiDraft}
          onDraftChange={setMultiDraft}
          onBack={onBack}
        />
      );
    case 'watermark-evidence':
      return (
        <WatermarkEvidenceScreen
          run={run}
          now={now}
          draft={watermarkDraft}
          onDraftChange={setWatermarkDraft}
          onBack={onBack}
        />
      );
    case 'quality-lab':
      return (
        <QualityLabScreen
          run={run}
          draft={qualityDraft}
          onDraftChange={setQualityDraft}
          onBack={onBack}
        />
      );
    default: {
      const exhaustiveRoute: never = route;
      return exhaustiveRoute;
    }
  }
}
