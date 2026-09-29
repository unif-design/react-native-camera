import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Card,
  Tag,
  fw,
  r,
  rf,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';
import type { CameraInput } from '@unif/react-native-camera';

export type ConfigPreviewProps = {
  config: CameraInput;
};

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: r(10),
    },
    title: {
      color: colors.foreground,
      fontSize: rf(15),
      fontWeight: fw.semi,
    },
    code: {
      color: colors.foregroundMuted,
      fontSize: rf(12),
      lineHeight: rf(18),
    },
  });

export function ConfigPreview({ config }: ConfigPreviewProps): ReactElement {
  const styles = useThemedStyles(makeStyles);

  return (
    <Card variant="plain">
      <View style={styles.header}>
        <Text style={styles.title}>本次 CameraInput</Text>
        <Tag label="只读" variant="outline" />
      </View>
      <Text selectable style={styles.code}>
        {JSON.stringify(config, null, 2)}
      </Text>
    </Card>
  );
}
