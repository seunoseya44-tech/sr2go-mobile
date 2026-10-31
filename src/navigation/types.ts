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
  Payment: { bookingId: string; connectionId?: string };
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
  // Build 8: trip day and safety record
  EvidenceCamera: { rideId: string; event: 'journey_start' | 'journey_complete' };
  JourneyRecord: { rideId: string; route?: string | null; bookingId?: string | null };
  PassengerTrip: { bookingId: string };
  TravellingWith: { bookingId: string };
  CompanionInvites: undefined;
  // Build 7
  TransferTicket: { bookingId: string };
  TransfersInbox: undefined;
  HandoverRide: { rideId: string };
  HandoversInbox: undefined;
  TripChat: { rideId: string; title?: string | null; subtitle?: string | null };
  TundeChat: undefined;
  RateTrip: {
    bookingId: string;
    revieweeId: string;
    name: string | null;
    route?: string | null;
    rideId?: string | null;
  };
  RatePassengers: { rideId: string };
  ReportProblem: { bookingId: string; route?: string | null; rideId?: string | null };
  MyReports: undefined;
  /** 30 Oct server features. */
  DriverBoardingList: { rideId: string };
  RideAlerts: undefined;
  PublicReviews: { userId: string; name?: string | null };
  WriteReview: { subjectId: string; bookingId: string; name?: string | null };
  MeetingPointProposals: { rideId: string; isDriver: boolean };
  JoinCompany: { token?: string } | undefined;
  MyCompany: undefined;
  /** Breakdown and rescue (build sheet, 2 Oct). */
  BreakdownStatus: { breakdownId: string; message?: string | null };
  BreakdownOpen: { breakdownId: string };
  Rescue: { rescueId: string };
  /** Journey card / receipt page fetched with the user's token (release 108, Step C). */
  Document: {
    title: string;
    path: string;
    pdfPath?: string;
    pdfName?: string;
    emailPath?: string;
  };
  DisputeRoom: { disputeId: string };
  ConnectionDetails: { index: number };
  ConnectionBook: { index: number };
  ConnectionStatus: { connectionId: string };
  // B6 account and wallet
  KycConsent: { next?: 'book' | 'post' } | undefined;
  KycSelfie: { next?: 'book' | 'post' } | undefined;
  /** selfieBase64 absent = use the selfie stored in the last hour (fix 2). */
  KycId: { selfieBase64?: string; next?: 'book' | 'post' };
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
