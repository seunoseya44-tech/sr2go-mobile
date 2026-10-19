import type { NavigatorScreenParams } from '@react-navigation/native';

import type { Place, RideSearchParams } from '../api/types';

export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  CreateAccount: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Trips: undefined;
  Wallet: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList>;
  DriverMain: NavigatorScreenParams<DriverTabParamList>;
  PlacePicker: {
    field: 'origin' | 'destination';
    current: Place | null;
    target?: 'search' | 'post';
  };
  SearchResults: { params: RideSearchParams };
  RideDetails: { rideId: string };
  DriverProfile: { driverId: string; name?: string | null };
  // B2
  BookSeat: { rideId: string };
  BookingStatus: { bookingId: string };
  Payment: { bookingId: string };
  PaymentResult: {
    bookingId: string;
    status: 'paid' | 'failed' | 'refund_due' | 'underpaid' | 'refunded' | 'pending';
    message?: string | null;
    youPaid?: string | null;
    reference?: string | null;
  };
  BookingConfirmation: { bookingId: string };
  BoardingPass: { bookingId: string };
  CancelBooking: { bookingId: string };
  ForgotPassword: undefined;
  // B6 account and wallet
  KycConsent: { next?: 'book' | 'post' } | undefined;
  KycSelfie: { next?: 'book' | 'post' } | undefined;
  KycId: { selfieBase64: string; next?: 'book' | 'post' };
  KycBank: { next?: 'book' | 'post' } | undefined;
  KycDone: { next?: 'book' | 'post' } | undefined;
  PersonalDetails: undefined;
  ChangePassword: undefined;
  EmergencyContact: undefined;
  DeleteAccount: undefined;
  Invite: undefined;
  SendCredit: undefined;
  TopUp: undefined;
  // B5 offline boarding
  ScanDriver: { bookingId: string };
  ConfirmDriver: {
    bookingId: string;
    scanned: string;
    name: string | null;
    verified: boolean;
    photo: string | null;
    vehicle: string | null;
    offline: boolean;
  };
  // B4 driver mode
  VehicleProfile: undefined;
  DriverReview: undefined;
  PostRideRoute: undefined;
  PostRidePrice: undefined;
  PostRideDetails: undefined;
  RideRequests: { rideId: string };
  DriverBoarding: { rideId: string };
  ScanPassenger: { rideId: string; bookingId?: string };
  ConfirmPassenger: {
    rideId: string;
    bookingId: string;
    name: string | null;
    photo: string | null;
    seats: number | null;
    children: number;
    /** Set when the check was done from the pack: the result is queued, not posted. */
    scanned?: string;
    offline?: boolean;
  };
  ActiveTrip: { rideId: string };
};

export type DriverTabParamList = {
  MyRides: undefined;
  PostRide: undefined;
  Earnings: undefined;
  DriverProfileTab: undefined;
};

export type RootStackParamList = AuthStackParamList &
  AppStackParamList & { VerifyPhone: undefined };

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
