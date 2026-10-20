import { useCallback, useEffect, useState } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  createNavigationContainerRef,
  type Theme,
} from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  Montserrat_300Light,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';

import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { useBoardingBackground } from './src/boarding/manager';
import { usePushNotifications } from './src/push';
import type { AppStackParamList } from './src/navigation/types';

import { BrandIntro } from './src/components/BrandIntro';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/theme';

const navigationRef = createNavigationContainerRef<AppStackParamList>();

/** Where a tapped push lands, by its data.type (SR2Go push names, 16–17 Oct). */
function openFromPush(type: string, data: Record<string, unknown>) {
  if (!navigationRef.isReady()) return;
  const bookingId = data.booking_id != null ? String(data.booking_id) : null;
  const rideId = data.ride_id != null ? String(data.ride_id) : null;
  if (type === 'transfer_offer' || type.startsWith('transfer_'))
    navigationRef.navigate('TransfersInbox');
  else if (type === 'handover_offer' || type.startsWith('handover_'))
    navigationRef.navigate('HandoversInbox');
  else if (type.startsWith('companion_')) navigationRef.navigate('CompanionInvites');
  else if (type === 'driver_changed' && bookingId)
    navigationRef.navigate('BookingConfirmation', { bookingId });
  else if (type === 'boarding_pack' && bookingId)
    navigationRef.navigate('BoardingPass', { bookingId });
  else if (type === 'booking_transferred' && rideId)
    navigationRef.navigate('RideRequests', { rideId });
  else if (bookingId) navigationRef.navigate('BookingConfirmation', { bookingId });
  else if (rideId) navigationRef.navigate('RideRequests', { rideId });
  else navigationRef.navigate('Main', { screen: 'Trips' });
}

// Keep the native splash visible until fonts and the stored session are ready,
// so users never see a flash of the login screen before being signed in.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 60_000, refetchOnWindowFocus: false },
  },
});

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.brand,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
};

function AppContent({ fontsReady }: { fontsReady: boolean }) {
  const { status } = useAuth();
  const ready = fontsReady && status !== 'restoring';
  const [introDone, setIntroDone] = useState(false);
  const finishIntro = useCallback(() => setIntroDone(true), []);
  useBoardingBackground(status === 'signedIn');
  usePushNotifications(status === 'signedIn', openFromPush);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <NavigationContainer ref={navigationRef} theme={navigationTheme}>
        <RootNavigator />
      </NavigationContainer>
      {/* Animated logo over the first screen; the native splash hands off to it. */}
      {introDone ? null : <BrandIntro onDone={finishIntro} />}
    </>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Montserrat_300Light,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {/* If fonts fail to load, carry on with system fonts rather than hang. */}
            <AppContent fontsReady={fontsLoaded || !!fontError} />
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
