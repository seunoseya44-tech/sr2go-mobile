import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { colors, spacing, TAP, typography } from '../theme';
import { OfflineNotice } from './OfflineNotice';

interface TopBarProps {
  /** Centred title; omit for a bare chevron. */
  title?: string;
  /** 'back' shows a chevron, 'close' an X, 'none' nothing. */
  leading?: 'back' | 'close' | 'none';
  onLeadingPress?: () => void;
  trailing?: ReactNode;
}

export function TopBar({ title, leading = 'back', onLeadingPress, trailing }: TopBarProps) {
  const navigation = useNavigation();
  const goBack = onLeadingPress ?? (() => navigation.goBack());
  return (
    <View style={styles.topBar}>
      <View style={styles.topSide}>
        {leading !== 'none' ? (
          <Pressable
            onPress={goBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={leading === 'close' ? 'Close' : 'Back'}
            style={styles.topButton}
            testID="top-bar-leading"
          >
            <Ionicons
              name={leading === 'close' ? 'close' : 'chevron-back'}
              size={26}
              color={colors.text}
            />
          </Pressable>
        ) : null}
      </View>
      {title ? (
        <Text style={styles.topTitle} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={styles.flex} />
      )}
      <View style={[styles.topSide, styles.topSideEnd]}>{trailing}</View>
    </View>
  );
}

interface ScreenProps {
  children: ReactNode;
  /** Pinned to the bottom, above the safe area (primary button and footer links). */
  footer?: ReactNode;
  topBar?: TopBarProps | null;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  background?: string;
  statusBar?: 'light' | 'dark';
  testID?: string;
}

/**
 * Page scaffold: safe areas, optional top bar, scrolling content with the
 * standard 24px side margin, and a footer pinned above the home indicator.
 */
export function Screen({
  children,
  footer,
  topBar = { leading: 'back' },
  scroll = true,
  contentStyle,
  background = colors.background,
  statusBar = 'dark',
  testID,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const body = <View style={[styles.content, contentStyle]}>{children}</View>;

  return (
    <View style={[styles.root, { backgroundColor: background }]} testID={testID}>
      <StatusBar style={statusBar} />
      <View style={{ height: insets.top }} />
      <OfflineNotice />
      {topBar ? <TopBar {...topBar} /> : null}
      <KeyboardAvoidingView
        style={styles.flex}
        // Item 17: Android draws edge to edge, so the window no longer resizes for the
        // keyboard; pad on both platforms so the focused box stays visible.
        behavior="padding"
      >
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {body}
          </ScrollView>
        ) : (
          body
        )}
        {footer ? (
          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    height: 52,
  },
  topSide: { width: TAP, alignItems: 'flex-start' },
  topSideEnd: { alignItems: 'flex-end' },
  topButton: {
    width: TAP,
    height: TAP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    ...typography.heading,
    fontSize: 22,
    lineHeight: 28,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  scroll: { flexGrow: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    backgroundColor: 'transparent',
  },
});
