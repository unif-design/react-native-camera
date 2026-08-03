import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  EntryCard,
  fw,
  r,
  rf,
  useThemedStyles,
  type ColorTokens,
  type IconName,
} from '@unif/react-native-design';

import { ResultHistory } from '../components/ResultHistory';
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
  });

export function HomeScreen({ run, onNavigate }: HomeScreenProps): ReactElement {
  const styles = useThemedStyles(makeStyles);

  return (
    <ShowcaseScaffold
      title="Camera 能力展厅"
      description="四个场景共享同一个根级 camera API 与进程内 controller，返回文件只在临时目录中保留。"
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

      <ResultHistory run={run} />
    </ShowcaseScaffold>
  );
}
