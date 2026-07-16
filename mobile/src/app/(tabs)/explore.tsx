import { Platform, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { filterFullyAccessible } from '@tilgjengelighet/shared';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Collapsible } from '@/components/ui/collapsible';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function TabTwoScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };
  const theme = useTheme();
  const demoAccessibleCount = filterFullyAccessible([
    {
      props: new Map([
        ['tilgjengvurderingrulleman', 'Tilgjengelig'],
        ['tilgjengvurderingrulleauto', 'Tilgjengelig'],
        ['tilgjengvurderingelrullestol', 'Tilgjengelig'],
        ['tilgjengvurderingsyn', 'Tilgjengelig'],
      ]),
    },
    {
      props: new Map([
        ['tilgjengvurderingrulleman', 'Ikke tilgjengelig'],
        ['tilgjengvurderingrulleauto', 'Tilgjengelig'],
        ['tilgjengvurderingelrullestol', 'Tilgjengelig'],
        ['tilgjengvurderingsyn', 'Tilgjengelig'],
      ]),
    },
  ]).length;

  const contentPlatformStyle = Platform.select({
    android: {
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom,
    },
    web: {
      paddingTop: Spacing.six,
      paddingBottom: Spacing.four,
    },
  });

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="subtitle">Status</ThemedText>
          <ThemedText style={styles.centerText} themeColor="textSecondary">
            Web and mobile targets are now kept in one repository.
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.sectionsWrapper}>
          <Collapsible title="Deployment targets">
            <ThemedText type="small">
              Web app: GitHub Pages from project root.
            </ThemedText>
            <ThemedText type="small">
              Mobile app: Expo project in <ThemedText type="code">mobile/</ThemedText> for Android
              and iOS.
            </ThemedText>
          </Collapsible>

          <Collapsible title="Current mobile strategy">
            <ThemedView type="backgroundElement" style={styles.collapsibleContent}>
              <ThemedText type="small">
                The map tab now renders with native map components and a WMS tile overlay.
              </ThemedText>
              <ThemedText type="small">
                Shared accessibility filter check (demo): {demoAccessibleCount} fully accessible
                segment(s) detected.
              </ThemedText>
            </ThemedView>
          </Collapsible>

          <Collapsible title="Next migration steps">
            <ThemedText type="small">
              1. Add native layer toggles, feature tap queries, and highscore stats.
            </ThemedText>
            <ThemedText type="small">
              2. Expand shared cross-platform logic package for data parsing and formatting.
            </ThemedText>
            <ThemedText type="small">
              3. Use EAS workflows for TestFlight and Play Store release automation.
            </ThemedText>
          </Collapsible>
        </ThemedView>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  container: {
    maxWidth: MaxContentWidth,
    flexGrow: 1,
  },
  titleContainer: {
    gap: Spacing.three,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
  },
  centerText: {
    textAlign: 'center',
  },
  sectionsWrapper: {
    gap: Spacing.five,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  collapsibleContent: {
    alignItems: 'flex-start',
  },
});
