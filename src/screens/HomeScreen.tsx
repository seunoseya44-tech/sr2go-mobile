import { useCallback, useState, type ReactNode } from 'react';
import { Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toApiError } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import { getExpiry } from '../auth/jwt';
import { Banner } from '../components/Banner';
import { BrandMark } from '../components/BrandMark';
import { Button } from '../components/Button';
import { OfflineNotice } from '../components/OfflineNotice';
import { colors, radius, shadow, spacing, typography } from '../theme';
import { capitalize, displayName, greeting, initials, relativeExpiry } from '../utils/format';

type IconName = keyof typeof Ionicons.glyphMap;

export function HomeScreen() {
  const { user, tokens, signOut, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await refreshProfile();
    } catch (error) {
      setRefreshError(toApiError(error).message);
    } finally {
      setRefreshing(false);
    }
  }, [refreshProfile]);

  const confirmSignOut = () => {
    const title = 'Sign out?';
    const message = "You'll need to sign in again to book or manage rides.";
    // Alert.alert is a no-op on react-native-web.
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) void signOut();
      return;
    }
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  const expiry = tokens ? getExpiry(tokens.accessToken) : null;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textOnBrand}
            colors={[colors.brand]}
          />
        }
      >
        <LinearGradient
          colors={[colors.midnight, colors.navy]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}
        >
          <View style={styles.topBar}>
            <BrandMark size="md" />
            <View style={styles.avatar} accessibilityLabel="Your profile">
              <Text style={styles.avatarText}>{initials(user)}</Text>
            </View>
          </View>

          <View style={styles.greetingBlock}>
            <Text style={styles.greeting} testID="home-greeting">
              {greeting()}, {displayName(user)}
            </Text>
            <Text style={styles.greetingSub}>Where are you heading today?</Text>
          </View>
        </LinearGradient>

        <OfflineNotice />

        <View style={styles.content}>
          <View style={[styles.card, styles.successCard]} testID="signed-in-card">
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={20} color={colors.textOnBrand} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>You’re signed in</Text>
              <Text style={styles.cardBody}>Your session is stored securely on this device.</Text>
            </View>
          </View>

          {refreshError ? (
            <Banner tone="error" message={refreshError} onDismiss={() => setRefreshError(null)} />
          ) : null}

          <Section title="Profile">
            <Row icon="person-outline" label="Name" value={user?.fullName} />
            <Row icon="mail-outline" label="Email" value={user?.email} />
            <Row icon="call-outline" label="Phone" value={user?.phone} />
            <Row
              icon="briefcase-outline"
              label="Account type"
              value={user?.role ? capitalize(user.role) : null}
            />
            <Row
              icon="shield-checkmark-outline"
              label="Verification"
              value={user?.isVerified == null ? null : user.isVerified ? 'Verified' : 'Pending'}
              valueColor={user?.isVerified ? colors.success : colors.warning}
              last
            />
          </Section>

          <Section title="Session">
            <Row
              icon="key-outline"
              label="Token type"
              value={capitalize(tokens?.tokenType ?? '')}
            />
            <Row
              icon="time-outline"
              label="Access token expires"
              value={expiry ? relativeExpiry(expiry) : 'No expiry set'}
            />
            <Row
              icon="refresh-outline"
              label="Auto-renewal"
              value={tokens?.refreshToken ? 'Enabled' : 'Not available'}
              last
            />
          </Section>

          <Button
            testID="logout-button"
            title="Sign out"
            icon="log-out-outline"
            variant="secondary"
            onPress={confirmSignOut}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

interface RowProps {
  icon: IconName;
  label: string;
  value: string | null | undefined;
  valueColor?: string;
  last?: boolean;
}

function Row({ icon, label, value, valueColor, last }: RowProps) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          { color: value ? (valueColor ?? colors.text) : colors.textSubtle },
        ]}
        numberOfLines={1}
      >
        {value || 'Not provided'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.label,
    color: colors.textOnBrand,
  },
  greetingBlock: {
    gap: spacing.xxs,
  },
  greeting: {
    ...typography.title,
    color: colors.textOnBrand,
  },
  greetingSub: {
    ...typography.body,
    color: 'rgba(255,255,255,0.75)',
  },
  content: {
    marginTop: -spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    ...shadow.card,
  },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  successIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    ...typography.heading,
    color: colors.text,
  },
  cardBody: {
    ...typography.label,
    color: colors.textMuted,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginLeft: spacing.xxs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    ...typography.body,
    color: colors.textMuted,
  },
  rowValue: {
    ...typography.bodyMedium,
    flex: 1,
    textAlign: 'right',
  },
});
