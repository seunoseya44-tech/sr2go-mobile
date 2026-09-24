import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Auth flow: which screens are *registered* depends on the auth state, so a
 * signed-out user can't reach Home (not even with the back gesture) and a
 * signed-in user can't go back to Login. Signing in or out swaps the stack.
 *
 * While the session is being restored the native splash screen stays up
 * (see App.tsx), so nothing is rendered here.
 */
export function RootNavigator() {
  const { status } = useAuth();

  if (status === 'restoring') return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {status === 'signedIn' ? (
        <Stack.Screen name="Home" component={HomeScreen} options={{ animation: 'fade' }} />
      ) : (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          // Signing out should feel like leaving, not like going "back".
          options={{ animation: 'fade', animationTypeForReplace: 'pop' }}
        />
      )}
    </Stack.Navigator>
  );
}
