import { useState, type ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Button,
  fw,
  r,
  rf,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';

import type { CameraRunController } from '../domain/cameraRun';
import { ResultSummary, useCameraRunSnapshot } from './ResultSummary';

export type ResultHistoryProps = {
  run: CameraRunController;
};

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    root: {
      gap: r(10),
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    title: {
      color: colors.foreground,
      fontSize: rf(16),
      fontWeight: fw.semi,
    },
    records: {
      gap: r(12),
    },
  });

export function ResultHistory({ run }: ResultHistoryProps): ReactElement {
  const [expandedRecordIds, setExpandedRecordIds] = useState<Set<string>>(
    () => new Set()
  );
  const styles = useThemedStyles(makeStyles);
  const snapshot = useCameraRunSnapshot(run);
  const records = [...snapshot.records].reverse();

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>本进程历史</Text>
        {records.length > 0 ? (
          <Button
            label="清空历史"
            variant="text"
            size="sm"
            onPress={run.clear}
            accessibilityHint="清除本次 App 进程内的拍摄记录"
          />
        ) : null}
      </View>
      <View style={styles.records}>
        {records.length > 0 ? (
          records.map((record, index) => {
            const isLatest = index === 0;
            const detailsExpanded =
              isLatest || expandedRecordIds.has(record.id);

            return (
              <ResultSummary
                key={record.id}
                record={record}
                detailsExpanded={detailsExpanded}
                onToggleDetails={
                  isLatest
                    ? undefined
                    : () => {
                        setExpandedRecordIds((currentIds) => {
                          const nextIds = new Set(currentIds);
                          if (nextIds.has(record.id)) {
                            nextIds.delete(record.id);
                          } else {
                            nextIds.add(record.id);
                          }
                          return nextIds;
                        });
                      }
                }
              />
            );
          })
        ) : (
          <ResultSummary />
        )}
      </View>
    </View>
  );
}
