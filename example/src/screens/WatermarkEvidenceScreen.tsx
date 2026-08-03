import { useState, type ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Button,
  Card,
  Input,
  Segmented,
  Textarea,
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
import { ShowcaseScaffold } from '../components/ShowcaseScaffold';
import type { CameraRunController } from '../domain/cameraRun';
import { buildWatermarkConfig } from '../domain/scenarioConfigs';

export type WatermarkEvidenceScreenProps = {
  run: CameraRunController;
  now: () => Date;
  onBack: () => void;
};

type WatermarkPosition = NonNullable<
  NonNullable<OpenConfig['watermark']>['position']
>;

const topPositions: { id: WatermarkPosition; label: string }[] = [
  { id: 'top-left', label: '左上' },
  { id: 'top-center', label: '中上' },
  { id: 'top-right', label: '右上' },
];

const bottomPositions: { id: WatermarkPosition; label: string }[] = [
  { id: 'bottom-left', label: '左下' },
  { id: 'bottom-center', label: '中下' },
  { id: 'bottom-right', label: '右下' },
];

function isWatermarkPosition(value: string): value is WatermarkPosition {
  return [...topPositions, ...bottomPositions].some(
    (position) => position.id === value
  );
}

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    form: {
      gap: r(12),
    },
    field: {
      gap: r(7),
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
    positionRows: {
      gap: r(8),
    },
    previewPending: {
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

export function WatermarkEvidenceScreen({
  run,
  now,
  onBack,
}: WatermarkEvidenceScreenProps): ReactElement {
  const styles = useThemedStyles(makeStyles);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [position, setPosition] = useState<WatermarkPosition>('top-right');
  const [titleError, setTitleError] = useState<string | undefined>();
  const [submittedConfig, setSubmittedConfig] = useState<OpenConfig | null>(
    null
  );
  const snapshot = useCameraRunSnapshot(run);
  const opening = snapshot.phase === 'opening';
  const latestRecord = [...snapshot.records]
    .reverse()
    .find((record) => record.scenario === 'watermark-evidence');

  const openCamera = async (): Promise<void> => {
    const result = buildWatermarkConfig(
      { title, location, note, position },
      now()
    );
    if (!result.ok) {
      setTitleError(result.fieldError.message);
      return;
    }

    setTitleError(undefined);
    setSubmittedConfig(result.config);
    try {
      await run.open('watermark-evidence', result.config);
    } catch {
      // controller 已记录 runtime diagnostic，页面只等待下一次 snapshot。
    }
  };

  return (
    <ShowcaseScaffold
      title="水印存证"
      description="水印只作用于 JPEG"
      onBack={onBack}
    >
      <Card variant="plain">
        <View style={styles.form}>
          <Text style={styles.explanation}>
            水印是可视标记，不是防篡改证明。地点完全由手工输入，本页不会请求定位权限。
          </Text>
          <View style={styles.field}>
            <Text style={styles.label}>记录标题（必填）</Text>
            <Input
              value={title}
              onChangeText={setTitle}
              accessibilityLabel="记录标题"
              placeholder="例如：设备巡检记录"
              error={titleError}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>手工地点</Text>
            <Input
              value={location}
              onChangeText={setLocation}
              accessibilityLabel="手工地点"
              placeholder="例如：A 区东门"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>备注</Text>
            <Textarea
              value={note}
              onChangeText={setNote}
              accessibilityLabel="备注"
              placeholder="补充现场信息"
              maxLength={200}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>水印位置</Text>
            <View style={styles.positionRows}>
              <Segmented
                value={position}
                items={topPositions}
                onChange={(value) => {
                  if (isWatermarkPosition(value)) {
                    setPosition(value);
                  }
                }}
              />
              <Segmented
                value={position}
                items={bottomPositions}
                onChange={(value) => {
                  if (isWatermarkPosition(value)) {
                    setPosition(value);
                  }
                }}
              />
            </View>
          </View>
        </View>
      </Card>

      {submittedConfig ? (
        <ConfigPreview config={submittedConfig} />
      ) : (
        <Card variant="plain">
          <Text style={styles.previewPending}>
            点击打开相机时生成当前时间，并展示实际提交的 OpenConfig。
          </Text>
        </Card>
      )}
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
