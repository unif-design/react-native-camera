import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Button,
  EntryCard,
  fw,
  r,
  rf,
  useThemedStyles,
  type ColorTokens,
  type IconName,
} from '@unif/react-native-design';

import {
  ResultSummary,
  useCameraRunSnapshot,
} from '../components/ResultSummary';
import { ShowcaseScaffold } from '../components/ShowcaseScaffold';
import type { CameraRunController } from '../domain/cameraRun';
import type { ShowcaseRoute } from '../navigation/localNavigation';

export type HomeScreenProps = {
  run: CameraRunController;
  onNavigate: (route: ShowcaseRoute) => void;
};

type Entry = {
  title: string;
  sub: string;
  icon: IconName;
  route: Exclude<ShowcaseRoute, { name: 'home' }>;
};

const entries: readonly Entry[] = [
  {
    title: '基础拍摄',
    sub: '单拍、连拍或录像',
    icon: 'camera',
    route: { name: 'basic-capture' },
  },
  {
    title: '多模式',
    sub: '比较 clear 与 retain',
    icon: 'list',
    route: { name: 'multi-mode' },
  },
  {
    title: '水印存证',
    sub: '把可见信息烧入照片',
    icon: 'shield-check',
    route: { name: 'watermark-evidence' },
  },
  {
    title: '质量实验室',
    sub: '显式参数与 SDK 默认',
    icon: 'settings',
    route: { name: 'quality-lab' },
  },
];

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    sectionTitle: {
      color: colors.foreground,
      fontSize: rf(16),
      fontWeight: fw.semi,
    },
    entryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: r(10),
    },
    entry: {
      flexBasis: '47%',
      flexGrow: 1,
    },
    history: {
      gap: r(10),
    },
    historyHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
  });

export function HomeScreen({ run, onNavigate }: HomeScreenProps): ReactElement {
  const styles = useThemedStyles(makeStyles);
  const snapshot = useCameraRunSnapshot(run);
  const records = [...snapshot.records].reverse();

  return (
    <ShowcaseScaffold
      title="Camera 能力展厅"
      description="四个场景都通过同一个进程内 controller 调用公开 useCamera()，返回文件只在临时目录中保留。"
    >
      <Text style={styles.sectionTitle}>选择场景</Text>
      <View style={styles.entryGrid}>
        {entries.map((entry) => (
          <EntryCard
            key={entry.route.name}
            icon={entry.icon}
            title={entry.title}
            sub={entry.sub}
            style={styles.entry}
            onPress={() => onNavigate(entry.route)}
          />
        ))}
      </View>

      <View style={styles.history}>
        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle}>本进程历史</Text>
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
        {records.length > 0 ? (
          records.map((record) => (
            <ResultSummary key={record.id} record={record} />
          ))
        ) : (
          <ResultSummary />
        )}
      </View>
    </ShowcaseScaffold>
  );
}
