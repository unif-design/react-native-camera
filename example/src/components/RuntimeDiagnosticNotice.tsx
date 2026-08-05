import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Card,
  Icon,
  fw,
  r,
  rf,
  useColors,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';

import type { CameraRunRecord, RuntimeDiagnostic } from '../domain/cameraRun';

export type RuntimeDiagnosticNoticeProps = {
  diagnostics: readonly RuntimeDiagnostic[];
  scenario: CameraRunRecord['scenario'];
};

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    content: {
      gap: r(6),
    },
    heading: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: r(8),
    },
    title: {
      color: colors.error,
      fontSize: rf(14),
      fontWeight: fw.semi,
    },
    message: {
      color: colors.foreground,
      fontSize: rf(13),
      lineHeight: rf(20),
    },
    guidance: {
      color: colors.foregroundMuted,
      fontSize: rf(12),
      lineHeight: rf(18),
    },
  });

export function RuntimeDiagnosticNotice({
  diagnostics,
  scenario,
}: RuntimeDiagnosticNoticeProps): ReactElement | null {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const diagnostic = [...diagnostics]
    .reverse()
    .find((item) => item.scenario === scenario);

  if (!diagnostic) {
    return null;
  }

  return (
    <Card variant="plain" borderColor={colors.error}>
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        accessibilityLabel={`相机运行异常：${diagnostic.message}`}
        style={styles.content}
      >
        <View style={styles.heading}>
          <Icon name="error-alert" size={r(20)} color={colors.error} />
          <Text style={styles.title}>相机运行异常</Text>
        </View>
        <Text style={styles.message}>{diagnostic.message}</Text>
        <Text style={styles.guidance}>
          本次没有生成 CameraResult，请检查运行环境后重试。
        </Text>
      </View>
    </Card>
  );
}
