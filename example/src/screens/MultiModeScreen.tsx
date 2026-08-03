import { useState, type ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Button,
  Card,
  Segmented,
  fw,
  r,
  rf,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';
import type { DataRetainedMode } from '@unif/react-native-camera';

import { ConfigPreview } from '../components/ConfigPreview';
import {
  ResultSummary,
  useCameraRunSnapshot,
} from '../components/ResultSummary';
import { ShowcaseScaffold } from '../components/ShowcaseScaffold';
import type { CameraRunController } from '../domain/cameraRun';
import { buildMultiModeConfig } from '../domain/scenarioConfigs';

export type MultiModeScreenProps = {
  run: CameraRunController;
  onBack: () => void;
};

const retainedModeItems: {
  id: DataRetainedMode;
  label: string;
}[] = [
  { id: 'clear', label: '切换时清理' },
  { id: 'retain', label: '跨模式保留' },
];

function isRetainedMode(value: string): value is DataRetainedMode {
  return value === 'clear' || value === 'retain';
}

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    control: {
      gap: r(10),
    },
    label: {
      color: colors.foreground,
      fontSize: rf(13),
      fontWeight: fw.semi,
    },
    explanation: {
      color: colors.foregroundMuted,
      fontSize: rf(13),
      lineHeight: rf(20),
    },
    sectionTitle: {
      color: colors.foreground,
      fontSize: rf(16),
      fontWeight: fw.semi,
    },
  });

export function MultiModeScreen({
  run,
  onBack,
}: MultiModeScreenProps): ReactElement {
  const styles = useThemedStyles(makeStyles);
  const [retainedMode, setRetainedMode] = useState<DataRetainedMode>('clear');
  const snapshot = useCameraRunSnapshot(run);
  const opening = snapshot.phase === 'opening';
  const config = buildMultiModeConfig(retainedMode);
  const latestRecord = [...snapshot.records]
    .reverse()
    .find((record) => record.scenario === 'multi-mode');

  const openCamera = async (): Promise<void> => {
    try {
      await run.open('multi-mode', config);
    } catch {
      // controller 已记录 runtime diagnostic，页面只等待下一次 snapshot。
    }
  };

  return (
    <ShowcaseScaffold
      title="多模式"
      description="一次打开同时提供单拍、连拍和录像，在相机内切换并比较文件保留语义。"
      onBack={onBack}
    >
      <Card variant="plain">
        <View style={styles.control}>
          <Text style={styles.label}>切换模式时的文件策略</Text>
          <Segmented
            value={retainedMode}
            items={retainedModeItems}
            onChange={(value) => {
              if (isRetainedMode(value)) {
                setRetainedMode(value);
              }
            }}
          />
          <Text style={styles.explanation}>
            {retainedMode === 'retain'
              ? '切换拍摄模式时保留已有文件，并继续累计。'
              : '切换拍摄模式时先确认，再清理已有文件。'}
          </Text>
        </View>
      </Card>

      <ConfigPreview config={config} />
      <Button
        label="打开相机"
        size="lg"
        block
        loading={opening}
        disabled={opening}
        onPress={openCamera}
      />

      <Text style={styles.sectionTitle}>最近结果</Text>
      <ResultSummary record={latestRecord} />
    </ShowcaseScaffold>
  );
}
