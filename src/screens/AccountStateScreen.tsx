import { Linking, Text, View } from 'react-native';

import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { LinkText } from '../components/ui';
import { accountState, useAccountState } from '../state/accountState';
import { ResultIcon, shared } from './booking/shared';

/** C1 · Account suspended, C2 · Account closed. Shown instead of the app. */
export function AccountStateScreen() {
  const state = useAccountState();
  const { signOut } = useAuth();
  if (state.kind === 'ok') return null;
  const suspended = state.kind === 'suspended';
  return (
    <Screen
      testID="account-state"
      topBar={null}
      footer={
        suspended ? (
          <>
            <Button
              title="Redo identity check"
              onPress={() => {
                accountState.set({ kind: 'ok' });
              }}
            />
            <LinkText
              onPress={() =>
                Linking.openURL('mailto:support@shareride2go.com?subject=Suspended account')
              }
              style={{ alignSelf: 'center' }}
            >
              Contact support
            </LinkText>
          </>
        ) : (
          <>
            <Button
              title="Contact support"
              onPress={() =>
                Linking.openURL('mailto:support@shareride2go.com?subject=Closed account')
              }
            />
            <Button title="Log out" variant="secondary" onPress={() => void signOut()} />
          </>
        )
      }
    >
      <View style={shared.centered}>
        <ResultIcon icon={suspended ? 'alert' : 'close'} />
        <Text style={shared.heading}>
          {suspended ? 'Your account is suspended' : 'Your account has been closed'}
        </Text>
        <Text style={shared.body}>{state.message}</Text>
        {suspended ? (
          <Text style={shared.small}>Redo the selfie check to restore your account.</Text>
        ) : null}
      </View>
    </Screen>
  );
}
