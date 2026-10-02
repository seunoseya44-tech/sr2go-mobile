import { Alert, Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { Avatar, Badge, LinkText, ListRow } from '../components/ui';
import { env } from '../config/env';
import { colors, spacing, typography } from '../theme';

/** Screen 46 (B1 subset): header, the rows that exist today, Privacy · Terms, Log out. */
export function ProfileScreen() {
  const { user, signOut } = useAuth();

  const confirmSignOut = () => {
    const title = 'Log out of SR2Go?';
    if (Platform.OS === 'web') {
      if (window.confirm(title)) void signOut();
      return;
    }
    Alert.alert(title, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <Screen testID="profile-screen" topBar={null}>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.header}>
        <Avatar name={user?.fullName ?? user?.email ?? null} size={64} />
        <View style={styles.headerText}>
          <Text style={styles.name}>{user?.fullName ?? 'Your name'}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[user?.email, user?.phone].filter(Boolean).join(' · ')}
          </Text>
          {user?.kycComplete ? <Badge label="Verified" icon="checkmark" /> : null}
        </View>
      </View>

      <View>
        <ListRow icon="person-outline" title="Personal details" subtitle="Name and phone" />
        <ListRow
          icon="card-outline"
          title="Bank account"
          subtitle={user?.bankVerified ? 'Added' : 'Not added yet'}
        />
        <ListRow icon="call-outline" title="Emergency contact" subtitle="Used by the SOS button" />
        <ListRow
          icon="car-outline"
          title="Drive with SR2Go"
          subtitle="Add your vehicle to start posting rides"
        />
        <ListRow icon="key-outline" title="Change password" />
        <ListRow icon="flag-outline" title="My reports" />
      </View>

      <View style={styles.links}>
        <LinkText onPress={() => Linking.openURL(`${env.websiteUrl}/privacy`)}>Privacy</LinkText>
        <Text style={styles.dot}> · </Text>
        <LinkText onPress={() => Linking.openURL(`${env.websiteUrl}/terms`)}>Terms</LinkText>
      </View>

      <Button
        title="Log out"
        variant="secondary"
        onPress={confirmSignOut}
        testID="logout-button"
        style={styles.logout}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, gap: spacing.xxs },
  name: { ...typography.heading, color: colors.text },
  meta: { ...typography.secondary, color: colors.textMuted },
  links: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  dot: { color: colors.textMuted },
  logout: { marginTop: spacing.xs },
});
