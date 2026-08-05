import type { PropsWithChildren, ReactElement } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  NavBar,
  fw,
  r,
  rf,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';

export type ShowcaseScaffoldProps = PropsWithChildren<{
  title: string;
  description?: string;
  onBack?: () => void;
}>;

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flex: 1,
    },
    content: {
      gap: r(14),
      padding: r(16),
      paddingBottom: r(32),
    },
    description: {
      color: colors.foregroundMuted,
      fontSize: rf(14),
      fontWeight: fw.regular,
      lineHeight: rf(21),
    },
  });

export function ShowcaseScaffold({
  title,
  description,
  onBack,
  children,
}: ShowcaseScaffoldProps): ReactElement {
  const styles = useThemedStyles(makeStyles);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <NavBar
        title={title}
        left={
          onBack
            ? {
                icon: 'arrow-left',
                onPress: onBack,
                accessibilityLabel: '返回',
              }
            : undefined
        }
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
