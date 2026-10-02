import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../auth/AuthContext';
import { CreateAccountScreen } from '../screens/CreateAccountScreen';
import { DriverProfileScreen } from '../screens/DriverProfileScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { PlacePickerScreen } from '../screens/PlacePickerScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RideDetailsScreen } from '../screens/RideDetailsScreen';
import { SearchResultsScreen } from '../screens/SearchResultsScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { TripsScreen, WalletScreen } from '../screens/PlaceholderScreens';
import { VerifyPhoneScreen } from '../screens/VerifyPhoneScreen';
import { colors, fonts } from '../theme';
import type { AppStackParamList, AuthStackParamList, MainTabParamList } from './types';

const Auth = createNativeStackNavigator<AuthStackParamList>();
const App = createNativeStackNavigator<AppStackParamList>();
const Verify = createNativeStackNavigator<{ VerifyPhone: undefined }>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

type IconName = keyof typeof Ionicons.glyphMap;
const TAB_ICONS: Record<keyof MainTabParamList, [IconName, IconName]> = {
  Home: ['home', 'home-outline'],
  Trips: ['car', 'car-outline'],
  Wallet: ['wallet', 'wallet-outline'],
  Profile: ['person', 'person-outline'],
};

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.surface },
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={TAB_ICONS[route.name][focused ? 0 : 1]} size={size} color={color} />
        ),
      })}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Trips" component={TripsScreen} />
      <Tabs.Screen name="Wallet" component={WalletScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

/**
 * Auth flow: which navigator is mounted depends on the auth state, so a
 * signed-out user can't reach the app (not even with the back gesture), a
 * user who hasn't confirmed their phone sees only the OTP screen, and a
 * signed-in user can't go back to Login. Changing auth state swaps the tree.
 *
 * While the session is being restored the native splash screen stays up
 * (see App.tsx), so nothing is rendered here.
 */
export function RootNavigator() {
  const { status, phoneVerified } = useAuth();

  if (status === 'restoring') return null;

  if (status === 'signedOut') {
    return (
      <Auth.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Auth.Screen name="Splash" component={SplashScreen} options={{ animation: 'fade' }} />
        <Auth.Screen name="Login" component={LoginScreen} />
        <Auth.Screen name="CreateAccount" component={CreateAccountScreen} />
        <Auth.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      </Auth.Navigator>
    );
  }

  if (!phoneVerified) {
    return (
      <Verify.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Verify.Screen name="VerifyPhone" component={VerifyPhoneScreen} />
      </Verify.Navigator>
    );
  }

  return (
    <App.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <App.Screen name="Main" component={MainTabs} options={{ animation: 'fade' }} />
      <App.Screen
        name="PlacePicker"
        component={PlacePickerScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <App.Screen name="SearchResults" component={SearchResultsScreen} />
      <App.Screen name="RideDetails" component={RideDetailsScreen} />
      <App.Screen name="DriverProfile" component={DriverProfileScreen} />
    </App.Navigator>
  );
}
