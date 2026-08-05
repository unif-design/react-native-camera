import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Button,
  Card,
  Input,
  Segmented,
  Stepper,
  Switch,
  fw,
  r,
  rf,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';
import type { OpenConfig } from '@unif/react-native-camera';

import { ConfigPreview } from '../components/ConfigPreview';
import {
  ResultSummary,
  useCameraRunSnapshot,
} from '../components/ResultSummary';
import { RuntimeDiagnosticNotice } from '../components/RuntimeDiagnosticNotice';
import { ShowcaseScaffold } from '../components/ShowcaseScaffold';
import type { CameraRunController } from '../domain/cameraRun';
import { buildQualityConfig } from '../domain/scenarioConfigs';

export type QualityLabScreenProps = {
  run: CameraRunController;
  draft: QualityLabDraft;
  onDraftChange: (draft: QualityLabDraft) => void;
  onBack: () => void;
};

export type ExperimentKind = 'photo' | 'video';
export type PhotoPrioritization =
  | 'sdk-default'
  | 'speed'
  | 'balanced'
  | 'quality';
export type ExplicitPolicy = 'sdk-default' | 'explicit';

export type QualityLabDraft = {
  kind: ExperimentKind;
  photoQualityText: string;
  prioritization: PhotoPrioritization;
  hdrPolicy: ExplicitPolicy;
  hdrEnabled: boolean;
  recTime: number;
  bitRatePolicy: ExplicitPolicy;
  videoBitRateText: string;
};

export const initialQualityLabDraft: QualityLabDraft = {
  kind: 'photo',
  photoQualityText: '0.9',
  prioritization: 'sdk-default',
  hdrPolicy: 'sdk-default',
  hdrEnabled: false,
  recTime: 15,
  bitRatePolicy: 'sdk-default',
  videoBitRateText: '24000000',
};

const experimentItems: { id: ExperimentKind; label: string }[] = [
  { id: 'photo', label: '照片实验' },
  { id: 'video', label: '录像实验' },
];

const prioritizationItems: {
  id: PhotoPrioritization;
  label: string;
}[] = [
  { id: 'sdk-default', label: 'SDK 默认' },
  { id: 'speed', label: '速度优先' },
  { id: 'balanced', label: '均衡' },
  { id: 'quality', label: '质量优先' },
];

const hdrPolicyItems: { id: ExplicitPolicy; label: string }[] = [
  { id: 'sdk-default', label: 'SDK 默认' },
  { id: 'explicit', label: '显式控制' },
];

const bitRatePolicyItems: { id: ExplicitPolicy; label: string }[] = [
  { id: 'sdk-default', label: 'SDK 默认' },
  { id: 'explicit', label: '显式码率' },
];

function isExperimentKind(value: string): value is ExperimentKind {
  return value === 'photo' || value === 'video';
}

function isPhotoPrioritization(value: string): value is PhotoPrioritization {
  return prioritizationItems.some((item) => item.id === value);
}

function isExplicitPolicy(value: string): value is ExplicitPolicy {
  return value === 'sdk-default' || value === 'explicit';
}

function parseFiniteNumber(value: string): number | null {
  if (value.trim().length === 0) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    form: {
      gap: r(12),
    },
    field: {
      gap: r(8),
    },
    inline: {
      alignItems: 'center',
      flexDirection: 'row',
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

export function QualityLabScreen({
  run,
  draft,
  onDraftChange,
  onBack,
}: QualityLabScreenProps): ReactElement {
  const styles = useThemedStyles(makeStyles);
  const {
    kind,
    photoQualityText,
    prioritization,
    hdrPolicy,
    hdrEnabled,
    recTime,
    bitRatePolicy,
    videoBitRateText,
  } = draft;
  const snapshot = useCameraRunSnapshot(run);
  const opening = snapshot.phase === 'opening';
  const photoQuality = parseFiniteNumber(photoQualityText);
  const validPhotoQuality =
    photoQuality !== null && photoQuality >= 0 && photoQuality <= 1;
  const videoBitRate = parseFiniteNumber(videoBitRateText);
  const validVideoBitRate =
    bitRatePolicy === 'sdk-default' ||
    (videoBitRate !== null && videoBitRate > 0);

  let config: OpenConfig | null = null;
  if (kind === 'photo' && validPhotoQuality) {
    config = buildQualityConfig({
      kind: 'photo',
      quality: photoQuality,
      prioritization,
      hdr:
        hdrPolicy === 'sdk-default' ? 'sdk-default' : hdrEnabled ? 'on' : 'off',
    });
  } else if (kind === 'video' && validVideoBitRate) {
    config = buildQualityConfig({
      kind: 'video',
      recTime,
      videoBitRate: bitRatePolicy === 'sdk-default' ? null : videoBitRate,
    });
  }

  const latestRecord = [...snapshot.records]
    .reverse()
    .find((record) => record.scenario === 'quality-lab');

  const openCamera = async (): Promise<void> => {
    if (!config) {
      return;
    }
    try {
      await run.open('quality-lab', config);
    } catch {
      // controller 已记录 runtime diagnostic，页面只等待下一次 snapshot。
    }
  };

  return (
    <ShowcaseScaffold
      title="质量实验室"
      description="质量参数不等于分辨率设置"
      onBack={onBack}
    >
      <Card variant="plain">
        <View style={styles.form}>
          <Text style={styles.explanation}>
            “SDK 默认”会从 OpenConfig 完全省略对应 key，由相机 SDK
            自行协商；本页不暴露分辨率或画幅配置。
          </Text>
          <View style={styles.field}>
            <Text style={styles.label}>实验类型</Text>
            <Segmented
              value={kind}
              items={experimentItems}
              onChange={(value) => {
                if (isExperimentKind(value)) {
                  onDraftChange({ ...draft, kind: value });
                }
              }}
            />
          </View>

          {kind === 'photo' ? (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>JPEG quality（0 到 1）</Text>
                <Input
                  value={photoQualityText}
                  onChangeText={(value) => {
                    onDraftChange({ ...draft, photoQualityText: value });
                  }}
                  accessibilityLabel="JPEG quality"
                  keyboardType="decimal-pad"
                  error={
                    validPhotoQuality ? undefined : '请输入 0 到 1 的有限数'
                  }
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>照片质量优先级</Text>
                <Segmented
                  value={prioritization}
                  items={prioritizationItems}
                  onChange={(value) => {
                    if (isPhotoPrioritization(value)) {
                      onDraftChange({ ...draft, prioritization: value });
                    }
                  }}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>HDR 策略</Text>
                <Segmented
                  value={hdrPolicy}
                  items={hdrPolicyItems}
                  onChange={(value) => {
                    if (isExplicitPolicy(value)) {
                      onDraftChange({ ...draft, hdrPolicy: value });
                    }
                  }}
                />
                <View style={styles.inline}>
                  <Switch
                    value={hdrEnabled}
                    onChange={(value) => {
                      onDraftChange({ ...draft, hdrEnabled: value });
                    }}
                    disabled={hdrPolicy === 'sdk-default'}
                    accessibilityLabel="照片 HDR"
                  />
                  <Text style={styles.explanation}>
                    {hdrEnabled ? '显式开启 HDR' : '显式关闭 HDR'}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>最长录制秒数</Text>
                <Stepper
                  value={recTime}
                  onChange={(value) => {
                    onDraftChange({ ...draft, recTime: value });
                  }}
                  min={5}
                  max={120}
                  step={5}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>录像码率策略</Text>
                <Segmented
                  value={bitRatePolicy}
                  items={bitRatePolicyItems}
                  onChange={(value) => {
                    if (isExplicitPolicy(value)) {
                      onDraftChange({ ...draft, bitRatePolicy: value });
                    }
                  }}
                />
                <Input
                  value={videoBitRateText}
                  onChangeText={(value) => {
                    onDraftChange({ ...draft, videoBitRateText: value });
                  }}
                  accessibilityLabel="视频码率（bps）"
                  keyboardType="number-pad"
                  disabled={bitRatePolicy === 'sdk-default'}
                  error={
                    validVideoBitRate ? undefined : '请输入大于 0 的有限码率'
                  }
                />
              </View>
            </>
          )}
        </View>
      </Card>

      {config ? <ConfigPreview config={config} /> : null}
      <Button
        label="打开相机"
        size="lg"
        block
        loading={opening}
        disabled={opening || config === null}
        onPress={openCamera}
      />

      <RuntimeDiagnosticNotice
        diagnostics={snapshot.diagnostics}
        scenario="quality-lab"
      />
      <Text style={styles.sectionTitle}>最近结果</Text>
      <ResultSummary record={latestRecord} />
    </ShowcaseScaffold>
  );
}
