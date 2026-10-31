import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';

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
import {
  KycBankScreen,
  KycConsentScreen,
  KycDoneScreen,
  KycIdScreen,
  KycSelfieScreen,
} from '../screens/kyc/KycScreens';
import {
  ChangePasswordScreen,
  DeleteAccountScreen,
  EmergencyContactScreen,
  PersonalDetailsScreen,
} from '../screens/profile/ProfileScreens';
import {
  InviteScreen,
  SendCreditScreen,
  TopUpScreen,
  WalletScreen,
} from '../screens/wallet/WalletScreens';
import { TripsScreen } from '../screens/TripsScreen';
import { BoardingPassScreen } from '../screens/booking/BoardingPassScreen';
import { BookingConfirmationScreen } from '../screens/booking/BookingConfirmationScreen';
import { BookingStatusScreen } from '../screens/booking/BookingStatusScreen';
import { BookSeatScreen } from '../screens/booking/BookSeatScreen';
import { CancelBookingScreen } from '../screens/booking/CancelBookingScreen';
import { PaymentResultScreen } from '../screens/booking/PaymentResultScreen';
import { PaymentScreen } from '../screens/booking/PaymentScreen';
import { ConfirmDriverScreen, ScanDriverScreen } from '../screens/booking/ScanDriverScreens';
import { ActiveTripScreen } from '../screens/driver/ActiveTripScreen';
import {
  ConfirmPassengerScreen,
  DriverBoardingScreen,
  ScanPassengerScreen,
} from '../screens/driver/BoardingScreens';
import { EarningsScreen } from '../screens/driver/EarningsScreen';
import { MyRidesScreen } from '../screens/driver/MyRidesScreen';
import {
  PostRideDetailsScreen,
  PostRidePriceScreen,
  PostRideRouteScreen,
} from '../screens/driver/PostRideScreens';
import { RideRequestsScreen } from '../screens/driver/RideRequestsScreen';
import { DriverReviewScreen, VehicleProfileScreen } from '../screens/driver/VehicleProfileScreen';
import { useAppMode } from '../state/mode';
import { useAccountState } from '../state/accountState';
import { AccountStateScreen } from '../screens/AccountStateScreen';
import { EvidenceCameraScreen } from '../screens/driver/EvidenceCameraScreen';
import { JourneyRecordScreen, PassengerTripScreen } from '../screens/trip/TripDayScreens';
import { CompanionInvitesScreen, TravellingWithScreen } from '../screens/social/CompanionScreens';
import {
  ConnectionBookScreen,
  ConnectionDetailsScreen,
  ConnectionStatusScreen,
} from '../screens/connections/ConnectionScreens';
import {
  RatePassengersScreen,
  RateTripScreen,
  ReportProblemScreen,
} from '../screens/social/AfterTripScreens';
import { DisputeRoomScreen, MyReportsScreen } from '../screens/social/DisputeRoomScreens';
import { TripChatScreen, TundeChatScreen } from '../screens/social/ChatScreens';
import {
  HandoverRideScreen,
  HandoversInboxScreen,
  TransferTicketScreen,
  TransfersInboxScreen,
} from '../screens/social/OfferScreens';
import { VerifyPhoneScreen } from '../screens/VerifyPhoneScreen';
import { colors, fonts } from '../theme';
import type {
  AppStackParamList,
  AuthStackParamList,
  DriverTabParamList,
  MainTabParamList,
} from './types';
import { DocumentScreen } from '../screens/DocumentScreen';
import {
  DriverBoardingListScreen,
  JoinCompanyScreen,
  MeetingPointProposalsScreen,
  MyCompanyScreen,
  PublicReviewsScreen,
  RideAlertsScreen,
  WriteReviewScreen,
} from '../screens/features/FeatureScreens';
import {
  BreakdownOpenScreen,
  BreakdownStatusScreen,
  RescueScreen,
} from '../screens/features/BreakdownScreens';
import { PaymentChoicesScreen } from '../screens/wallet/PaymentChoicesScreen';

const Auth = createNativeStackNavigator<AuthStackParamList>();
const App = createNativeStackNavigator<AppStackParamList>();
const Verify = createNativeStackNavigator<{ VerifyPhone: undefined }>();
const Tabs = createBottomTabNavigator<MainTabParamList>();
const DriverTabs = createBottomTabNavigator<DriverTabParamList>();

type IconName = keyof typeof Ionicons.glyphMap;
const TAB_ICONS: Record<keyof MainTabParamList, [IconName, IconName]> = {
  Home: ['home', 'home-outline'],
  Trips: ['car', 'car-outline'],
  Wallet: ['wallet', 'wallet-outline'],
  Profile: ['person', 'person-outline'],
};

const DRIVER_TAB_ICONS: Record<keyof DriverTabParamList, [IconName, IconName, string]> = {
  MyRides: ['car', 'car-outline', 'My rides'],
  PostRide: ['add-circle', 'add-circle-outline', 'Post ride'],
  Earnings: ['cash', 'cash-outline', 'Earnings'],
  DriverProfileTab: ['person', 'person-outline', 'Profile'],
};

/** Driver mode tab bar: My rides, Post ride, Earnings, Profile. */
function DriverMainTabs() {
  return (
    <DriverTabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabel: DRIVER_TAB_ICONS[route.name][2],
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 13 },
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.surface },
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons
            name={DRIVER_TAB_ICONS[route.name][focused ? 0 : 1]}
            size={size}
            color={color}
          />
        ),
      })}
    >
      <DriverTabs.Screen name="MyRides" component={MyRidesScreen} />
      <DriverTabs.Screen name="PostRide" component={PostRideRouteScreen} />
      <DriverTabs.Screen name="Earnings" component={EarningsScreen} />
      <DriverTabs.Screen name="DriverProfileTab" component={ProfileScreen} />
    </DriverTabs.Navigator>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 13 },
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
  const mode = useAppMode();
  const account = useAccountState();

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

  if (account.kind !== 'ok') {
    return (
      <Verify.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Verify.Screen name="VerifyPhone" component={AccountStateScreen} />
      </Verify.Navigator>
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
      {mode === 'driver' ? (
        <App.Screen name="DriverMain" component={DriverMainTabs} options={{ animation: 'fade' }} />
      ) : null}
      <App.Screen name="Main" component={MainTabs} options={{ animation: 'fade' }} />
      {mode !== 'driver' ? (
        <App.Screen name="DriverMain" component={DriverMainTabs} options={{ animation: 'fade' }} />
      ) : null}
      <App.Screen
        name="PlacePicker"
        component={PlacePickerScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <App.Screen name="SearchResults" component={SearchResultsScreen} />
      <App.Screen name="RideDetails" component={RideDetailsScreen} />
      <App.Screen name="DriverProfile" component={DriverProfileScreen} />
      <App.Screen name="BookSeat" component={BookSeatScreen} />
      <App.Screen
        name="BookingStatus"
        component={BookingStatusScreen}
        options={{ gestureEnabled: false }}
      />
      <App.Screen name="Payment" component={PaymentScreen} />
      <App.Screen
        name="PaymentResult"
        component={PaymentResultScreen}
        options={{ gestureEnabled: false, animation: 'fade' }}
      />
      <App.Screen name="BookingConfirmation" component={BookingConfirmationScreen} />
      <App.Screen
        name="BoardingPass"
        component={BoardingPassScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <App.Screen name="CancelBooking" component={CancelBookingScreen} />
      <App.Screen
        name="EvidenceCamera"
        component={EvidenceCameraScreen}
        options={{ gestureEnabled: false, animation: 'fade' }}
      />
      <App.Screen name="JourneyRecord" component={JourneyRecordScreen} />
      <App.Screen name="Document" component={DocumentScreen} />
      <App.Screen name="DriverBoardingList" component={DriverBoardingListScreen} />
      <App.Screen name="RideAlerts" component={RideAlertsScreen} />
      <App.Screen name="PublicReviews" component={PublicReviewsScreen} />
      <App.Screen name="WriteReview" component={WriteReviewScreen} />
      <App.Screen name="MeetingPointProposals" component={MeetingPointProposalsScreen} />
      <App.Screen name="JoinCompany" component={JoinCompanyScreen} />
      <App.Screen name="MyCompany" component={MyCompanyScreen} />
      <App.Screen name="PaymentChoices" component={PaymentChoicesScreen} />
      <App.Screen name="BreakdownStatus" component={BreakdownStatusScreen} />
      <App.Screen name="BreakdownOpen" component={BreakdownOpenScreen} />
      <App.Screen name="Rescue" component={RescueScreen} />
      <App.Screen name="PassengerTrip" component={PassengerTripScreen} />
      <App.Screen name="TravellingWith" component={TravellingWithScreen} />
      <App.Screen name="CompanionInvites" component={CompanionInvitesScreen} />
      <App.Screen name="TransferTicket" component={TransferTicketScreen} />
      <App.Screen name="TransfersInbox" component={TransfersInboxScreen} />
      <App.Screen name="HandoverRide" component={HandoverRideScreen} />
      <App.Screen name="HandoversInbox" component={HandoversInboxScreen} />
      <App.Screen name="TripChat" component={TripChatScreen} />
      <App.Screen name="TundeChat" component={TundeChatScreen} />
      <App.Screen name="RateTrip" component={RateTripScreen} />
      <App.Screen name="RatePassengers" component={RatePassengersScreen} />
      <App.Screen name="ReportProblem" component={ReportProblemScreen} />
      <App.Screen name="MyReports" component={MyReportsScreen} />
      <App.Screen name="DisputeRoom" component={DisputeRoomScreen} />
      <App.Screen name="ConnectionDetails" component={ConnectionDetailsScreen} />
      <App.Screen name="ConnectionBook" component={ConnectionBookScreen} />
      <App.Screen name="ConnectionStatus" component={ConnectionStatusScreen} />
      <App.Screen name="KycConsent" component={KycConsentScreen} />
      <App.Screen name="KycSelfie" component={KycSelfieScreen} />
      <App.Screen name="KycId" component={KycIdScreen} />
      <App.Screen name="KycBank" component={KycBankScreen} />
      <App.Screen name="KycDone" component={KycDoneScreen} options={{ gestureEnabled: false }} />
      <App.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <App.Screen name="PersonalDetails" component={PersonalDetailsScreen} />
      <App.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <App.Screen name="EmergencyContact" component={EmergencyContactScreen} />
      <App.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      <App.Screen name="Invite" component={InviteScreen} />
      <App.Screen name="SendCredit" component={SendCreditScreen} />
      <App.Screen name="TopUp" component={TopUpScreen} />
      <App.Screen name="ScanDriver" component={ScanDriverScreen} options={{ animation: 'fade' }} />
      <App.Screen
        name="ConfirmDriver"
        component={ConfirmDriverScreen}
        options={{ gestureEnabled: false }}
      />
      <App.Screen name="VehicleProfile" component={VehicleProfileScreen} />
      <App.Screen name="DriverReview" component={DriverReviewScreen} />
      <App.Screen name="PostRideRoute" component={PostRideRouteScreen} />
      <App.Screen name="PostRidePrice" component={PostRidePriceScreen} />
      <App.Screen name="PostRideDetails" component={PostRideDetailsScreen} />
      <App.Screen name="RideRequests" component={RideRequestsScreen} />
      <App.Screen name="DriverBoarding" component={DriverBoardingScreen} />
      <App.Screen
        name="ScanPassenger"
        component={ScanPassengerScreen}
        options={{ animation: 'fade' }}
      />
      <App.Screen
        name="ConfirmPassenger"
        component={ConfirmPassengerScreen}
        options={{ gestureEnabled: false }}
      />
      <App.Screen
        name="ActiveTrip"
        component={ActiveTripScreen}
        options={{ gestureEnabled: false }}
      />
    </App.Navigator>
  );
}
