import type { ReactElement } from 'react';
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
import type {
  CameraModeName,
  CameraType,
  FlashMode,
} from '@unif/react-native-camera';

import { ConfigPreview } from '../components/ConfigPreview';
import {
  ResultSummary,
  useCameraRunSnapshot,
} from '../components/ResultSummary';
import { RuntimeDiagnosticNotice } from '../components/RuntimeDiagnosticNotice';
import { ShowcaseScaffold } from '../components/ShowcaseScaffold';
import type { CameraRunController } from '../domain/cameraRun';
import { buildBasicConfig } from '../domain/scenarioConfigs';

export type BasicCaptureScreenProps = {
  run: CameraRunController;
  draft: BasicCaptureDraft;
  onDraftChange: (draft: BasicCaptureDraft) => void;
  onBack: () => void;
};

export type BasicCaptureDraft = {
  mode: CameraModeName;
  cameraType: CameraType;
  flashMode: FlashMode;
};

export const initialBasicCaptureDraft: BasicCaptureDraft = {
  mode: 'single',
  cameraType: 'back',
  flashMode: 'auto',
};

const modeItems: { id: CameraModeName; label: string }[] = [
  { id: 'single', label: '单拍' },
  { id: 'continuous', label: '连拍' },
  { id: 'video', label: '录像' },
];

const cameraTypeItems: { id: CameraType; label: string }[] = [
  { id: 'back', label: '后摄' },
  { id: 'front', label: '前摄' },
];

const flashItems: { id: FlashMode; label: string }[] = [
  { id: 'auto', label: '自动' },
  { id: 'on', label: '开启' },
  { id: 'off', label: '关闭' },
];

function isCameraMode(value: string): value is CameraModeName {
  return value === 'single' || value === 'continuous' || value === 'video';
}

function isCameraType(value: string): value is CameraType {
  return value === 'front' || value === 'back';
}

function isFlashMode(value: string): value is FlashMode {
  return value === 'auto' || value === 'on' || value === 'off';
}

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    controls: {
      gap: r(12),
    },
    control: {
      gap: r(8),
    },
    label: {
      color: colors.foreground,
      fontSize: rf(13),
      fontWeight: fw.semi,
    },
    modeDetail: {
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

export function BasicCaptureScreen({
  run,
  draft,
  onDraftChange,
  onBack,
}: BasicCaptureScreenProps): ReactElement {
  const styles = useThemedStyles(makeStyles);
  const { mode, cameraType, flashMode } = draft;
  const snapshot = useCameraRunSnapshot(run);
  const opening = snapshot.phase === 'opening';
  const config = buildBasicConfig({
    mode,
    type: cameraType,
    flashMode,
    quality: 0.9,
    recTime: 15,
  });
  const latestRecord = [...snapshot.records]
    .reverse()
    .find((record) => record.scenario === 'basic-capture');

  const openCamera = async (): Promise<void> => {
    try {
      await run.open('basic-capture', config);
    } catch {
      // controller 已记录 runtime diagnostic，页面只等待下一次 snapshot。
    }
  };

  return (
    <ShowcaseScaffold
      title="基础拍摄"
      description="一次只传入一个 cameraMode，便于复制最小公开配置。"
      onBack={onBack}
    >
      <Card variant="plain">
        <View style={styles.controls}>
          <View style={styles.control}>
            <Text style={styles.label}>拍摄模式</Text>
            <Segmented
              value={mode}
              items={modeItems}
              onChange={(value) => {
                if (isCameraMode(value)) {
                  onDraftChange({ ...draft, mode: value });
                }
              }}
            />
          </View>
          <View style={styles.control}>
            <Text style={styles.label}>初始镜头</Text>
            <Segmented
              value={cameraType}
              items={cameraTypeItems}
              onChange={(value) => {
                if (isCameraType(value)) {
                  onDraftChange({ ...draft, cameraType: value });
                }
              }}
            />
          </View>
          <View style={styles.control}>
            <Text style={styles.label}>初始闪光</Text>
            <Segmented
              value={flashMode}
              items={flashItems}
              onChange={(value) => {
                if (isFlashMode(value)) {
                  onDraftChange({ ...draft, flashMode: value });
                }
              }}
            />
          </View>
          <Text style={styles.modeDetail}>
            {mode === 'video' ? '最长录制：15 秒' : '照片质量：0.9'}
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

      <RuntimeDiagnosticNotice
        diagnostics={snapshot.diagnostics}
        scenario="basic-capture"
      />
      <Text style={styles.sectionTitle}>最近结果</Text>
      <ResultSummary record={latestRecord} />
    </ShowcaseScaffold>
  );
}
