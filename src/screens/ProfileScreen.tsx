import { Alert, Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { Avatar, Badge, LinkText, ListRow } from '../components/ui';
import { env } from '../config/env';
import type { AppStackParamList } from '../navigation/types';
import { appMode, useAppMode } from '../state/mode';
import { colors, spacing, typography } from '../theme';

/** Screen 46 (B1 subset): header, the rows that exist today, Privacy · Terms, Log out. */
export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const mode = useAppMode();

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
          {user?.isVerified ? <Badge label="Verified" icon="checkmark" /> : null}
        </View>
      </View>

      <View>
        {!user?.isVerified ? (
          <ListRow
            icon="shield-checkmark-outline"
            title="Verify your identity"
            subtitle="NIN or BVN and a live selfie, about 2 minutes"
            onPress={() => navigation.navigate('KycConsent')}
            testID="verify-row"
          />
        ) : null}
        <ListRow
          icon="person-outline"
          title="Personal details"
          subtitle="Name and phone"
          onPress={() => navigation.navigate('PersonalDetails')}
        />
        {user?.role === 'driver' ? (
          <ListRow
            icon="card-outline"
            title="Bank account"
            subtitle={user?.bankVerified ? 'Added' : 'Not added yet'}
            onPress={() => navigation.navigate('KycBank')}
          />
        ) : null}
        <ListRow
          icon="call-outline"
          title="Emergency contact"
          subtitle="Used by the SOS button"
          onPress={() => navigation.navigate('EmergencyContact')}
        />
        <ListRow
          icon="car-outline"
          title={mode === 'driver' ? 'Switch to travelling' : 'Drive with SR2Go'}
          subtitle={
            mode === 'driver'
              ? 'Book seats as a passenger'
              : 'Add your vehicle to start posting rides'
          }
          onPress={() => {
            if (mode === 'driver') {
              appMode.set('passenger');
              navigation.navigate('Main', { screen: 'Home' });
            } else navigation.navigate('DriverReview');
          }}
          testID="drive-row"
        />
        <ListRow
          icon="key-outline"
          title="Change password"
          onPress={() => navigation.navigate('ChangePassword')}
        />
        <ListRow
          icon="flag-outline"
          title="My reports"
          onPress={() => navigation.navigate('MyReports')}
        />
        <ListRow
          icon="chatbubbles-outline"
          title="Chat with Tunde"
          subtitle="Ask about bookings, refunds and how SR2Go works"
          onPress={() => navigation.navigate('TundeChat')}
        />
        <ListRow
          icon="trash-outline"
          title="Delete account"
          onPress={() => navigation.navigate('DeleteAccount')}
        />
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
