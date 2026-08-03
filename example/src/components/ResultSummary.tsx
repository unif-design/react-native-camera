import { useSyncExternalStore, type ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Card,
  Tag,
  fw,
  r,
  rf,
  useThemedStyles,
  type ColorTokens,
  type TagVariant,
} from '@unif/react-native-design';

import type {
  CameraRunController,
  CameraRunRecord,
  CameraRunSnapshot,
} from '../domain/cameraRun';
import {
  classifyCameraResult,
  type ResultTone,
} from '../domain/resultPresentation';

export type ResultSummaryProps = {
  record?: CameraRunRecord;
};

const scenarioLabels: Readonly<Record<CameraRunRecord['scenario'], string>> = {
  'basic-capture': '基础拍摄',
  'multi-mode': '多模式',
  'watermark-evidence': '水印存证',
  'quality-lab': '质量实验室',
};

const toneVariants: Readonly<Record<ResultTone, TagVariant>> = {
  success: 'success',
  neutral: 'neutral',
  error: 'error',
};

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    empty: {
      color: colors.foregroundMuted,
      fontSize: rf(13),
      lineHeight: rf(20),
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: r(8),
      justifyContent: 'space-between',
    },
    scenario: {
      color: colors.foreground,
      fontSize: rf(14),
      fontWeight: fw.semi,
    },
    details: {
      color: colors.foregroundMuted,
      fontSize: rf(12),
      lineHeight: rf(18),
      marginTop: r(8),
    },
    warning: {
      color: colors.error,
      fontSize: rf(12),
      lineHeight: rf(18),
      marginTop: r(6),
    },
  });

export function useCameraRunSnapshot(
  run: CameraRunController
): CameraRunSnapshot {
  return useSyncExternalStore(run.subscribe, run.getSnapshot, run.getSnapshot);
}

export function ResultSummary({ record }: ResultSummaryProps): ReactElement {
  const styles = useThemedStyles(makeStyles);

  if (!record) {
    return (
      <Card variant="plain">
        <Text style={styles.empty}>暂无本进程拍摄结果。</Text>
      </Card>
    );
  }

  const presentation = classifyCameraResult(record.result);
  const mediaLabel = `${presentation.media.length} 个临时文件`;

  return (
    <Card variant="plain">
      <View style={styles.header}>
        <Text style={styles.scenario}>{scenarioLabels[record.scenario]}</Text>
        <Tag
          label={presentation.label}
          variant={toneVariants[presentation.tone]}
        />
      </View>
      <Text style={styles.details}>
        结果码 {presentation.code} · {mediaLabel}
      </Text>
      {presentation.temporaryFileWarning ? (
        <Text style={styles.warning}>
          返回文件位于临时目录，请及时复制或上传。
        </Text>
      ) : null}
    </Card>
  );
}
