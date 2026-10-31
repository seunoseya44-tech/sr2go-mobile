import { create, type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { env } from '../config/env';
import { session } from '../auth/session';
import { toApiError } from './errors';
import { accountState } from '../state/accountState';
import { parseTokens } from './parsers';
import type { AuthTokens } from './types';

export const ENDPOINTS = {
  // Auth
  register: '/api/auth/register',
  login: '/api/auth/login',
  refresh: '/api/auth/refresh',
  me: '/api/auth/me',
  verifyPhone: '/api/auth/verify-phone',
  resendOtp: '/api/auth/resend-otp',
  fcmToken: '/api/auth/fcm-token',
  passwordResetRequest: '/api/users/password-reset/request',
  passwordResetConfirm: '/api/users/password-reset/confirm',
  // Referral
  referralValidate: '/api/referral/validate-code',
  referralProcessSignup: '/api/referral/process-signup',
  // Rides
  ridesSearch: '/api/rides/search',
  ride: (rideId: string) => `/api/rides/${rideId}`,
  rideRoute: (rideId: string) => `/api/rides/${rideId}/route`,
  boardingList: (rideId: string) => `/api/rides/${rideId}/boarding-list`,
  alerts: '/api/alerts/',
  alert: (id: string) => `/api/alerts/${id}`,
  reviews: '/api/reviews/',
  reviewsOf: (userId: string) => `/api/reviews/user/${userId}`,
  reviewReply: (id: string) => `/api/reviews/${id}/reply`,
  reviewFlag: (id: string) => `/api/reviews/${id}/flag`,
  meetingProposals: (rideId: string) => `/api/rides/${rideId}/meeting-point/proposals`,
  meetingProposalRespond: (rideId: string, id: string) =>
    `/api/rides/${rideId}/meeting-point/proposals/${id}/respond`,
  corporateInviteValidate: '/api/corporates/invite/validate',
  corporateInviteAccept: '/api/corporates/invites/accept',
  corporate: (id: string) => `/api/corporates/${id}`,
  businessTrip: (bookingId: string) => `/api/rides/bookings/${bookingId}/business-trip`,
  breakdownFile: '/api/breakdown/file',
  breakdown: (id: string) => `/api/breakdown/${id}`,
  rescue: (id: string) => `/api/breakdown/rescue/${id}`,
  rescueBook: (id: string, rideId: string) => `/api/breakdown/rescue/${id}/book/${rideId}`,
  rescueAbandon: (id: string) => `/api/breakdown/rescue/${id}/abandon`,
  rescueComplete: (id: string) => `/api/breakdown/rescue/${id}/complete`,
  driverPublic: (driverId: string) => `/api/drivers/${driverId}/public`,
  pricingTicker: '/api/v1/pricing/ticker',
  // Bookings and payment (B2)
  bookings: '/api/rides/bookings',
  bookingsMine: '/api/rides/bookings/mine',
  receipt: (bookingId: string) => `/api/rides/bookings/${bookingId}/receipt`,
  receiptPdf: (bookingId: string) => `/api/rides/bookings/${bookingId}/receipt/pdf`,
  receiptEmail: (bookingId: string) => `/api/rides/bookings/${bookingId}/receipt/email`,
  journeyCard: (bookingId: string) => `/api/rides/bookings/${bookingId}/journey-card`,
  appConfig: '/api/app/config',
  scanDriver: (bookingId: string) => `/api/rides/bookings/${bookingId}/scan-driver`,
  passengerConfirm: (bookingId: string) => `/api/rides/bookings/${bookingId}/passenger-confirm`,
  boardingPass: (bookingId: string) => `/api/rides/bookings/${bookingId}/boarding-pass`,
  rideContacts: (rideId: string) => `/api/rides/${rideId}/contacts`,
  trackingLink: (bookingId: string) => `/api/rides/bookings/${bookingId}/tracking-link`,
  cancellationPolicy: (bookingId: string) => `/api/cancellations/policy/${bookingId}`,
  cancelBooking: (bookingId: string) => `/api/cancellations/booking/${bookingId}`,
  // Driver mode (B4)
  driverProfile: '/api/drivers/profile',
  driverProfileMe: '/api/drivers/profile/me',
  meetingPoints: '/api/rides/meeting-points',
  suggestPrice: '/api/rides/suggest-price',
  checkPrice: '/api/rides/check-price',
  rides: '/api/rides/',
  driverMyRides: '/api/rides/driver/my-rides',
  rideBookings: (rideId: string) => `/api/rides/${rideId}/bookings`,
  bookingStatus: (bookingId: string) => `/api/rides/bookings/${bookingId}/status`,
  cancelRide: (rideId: string) => `/api/cancellations/ride/${rideId}`,
  driverArrived: (bookingId: string) => `/api/rides/bookings/${bookingId}/driver-arrived`,
  scanQr: (bookingId: string) => `/api/rides/bookings/${bookingId}/scan-qr`,
  verifyPin: (bookingId: string) => `/api/rides/bookings/${bookingId}/verify-pin`,
  confirmBoarding: (bookingId: string) => `/api/rides/bookings/${bookingId}/confirm-boarding`,
  startRide: (rideId: string) => `/api/rides/${rideId}/start`,
  completeRide: (rideId: string) => `/api/rides/${rideId}/complete`,
  gpsPoint: (bookingId: string) => `/api/rides/bookings/${bookingId}/gps-point`,
  escrowMe: '/api/escrow/me',
  escrowStrikes: '/api/escrow/strikes/me',
  rideEvidence: (rideId: string) => `/api/rides/${rideId}/evidence`,
  journeyRecord: (rideId: string) => `/api/rides/${rideId}/journey-record`,
  track: (token: string) => `/api/rides/track/${token}`,
  verifyVehicle: (bookingId: string) => `/api/rides/bookings/${bookingId}/verify-vehicle`,
  paymentInitiate: '/api/payments/initiate',
  paymentVerify: '/api/payments/verify',
  // Offline boarding (16 Oct 2026)
  boardingPublicKey: '/api/boarding/public-key',
  boardingPackBooking: (bookingId: string) => `/api/boarding/pack/booking/${bookingId}`,
  boardingPackRide: (rideId: string) => `/api/boarding/pack/ride/${rideId}`,
  boardingPackBookingSaved: (bookingId: string) => `/api/boarding/pack/booking/${bookingId}/saved`,
  boardingPackRideSaved: (rideId: string) => `/api/boarding/pack/ride/${rideId}/saved`,
  boardingSync: '/api/boarding/sync',
  // Build 7: transfers, handovers, chat, Tunde, ratings, disputes, connections
  transfersLookup: '/api/transfers/lookup',
  transfers: '/api/transfers',
  transferAction: (id: string, action: 'accept' | 'decline' | 'cancel') =>
    `/api/transfers/${id}/${action}`,
  companionsLookup: '/api/companions/lookup',
  companions: '/api/companions',
  companionAction: (id: string, action: 'accept' | 'decline' | 'cancel') =>
    `/api/companions/${id}/${action}`,
  handoversLookup: '/api/handovers/lookup',
  handovers: '/api/handovers',
  handoverAction: (id: string, action: 'accept' | 'decline' | 'cancel') =>
    `/api/handovers/${id}/${action}`,
  rideMessages: (rideId: string) => `/api/rides/${rideId}/messages`,
  tundeChat: '/api/tunde/chat',
  ratings: '/api/ratings/',
  disputes: '/api/disputes/',
  disputesMine: '/api/disputes/mine',
  disputeRooms: '/api/disputes/rooms',
  disputeMessages: (id: string) => `/api/disputes/${id}/messages`,
  disputePhotos: (id: string) => `/api/disputes/${id}/photos`,
  places: '/api/places',
  walletActivity: '/api/wallet/activity',
  connectionsSearch: '/api/connections/search',
  connections: '/api/connections',
  connection: (id: string) => `/api/connections/${id}`,
  connectionsMine: '/api/connections/mine',
  // KYC, profile, wallet (B6)
  kycStatus: '/api/kyc/status',
  selfieConsentConfig: '/api/kyc/selfie-consent-config',
  selfieConsent: '/api/kyc/selfie-consent',
  kycDojah: '/api/auth/kyc/dojah',
  kycBanks: '/api/kyc/banks',
  kycBanksResolve: '/api/kyc/banks/resolve',
  kycBankRegister: '/api/kyc/bank/register',
  usersMe: '/api/users/me',
  usersMePassword: '/api/users/me/password',
  referralWallet: '/api/referral/wallet',
  referralDashboard: '/api/referral/dashboard',
  referralGenerateCode: '/api/referral/generate-code',
  walletGiftLookup: '/api/wallet/gift/lookup',
  walletGift: '/api/wallet/gift',
  walletTopUpAccount: '/api/wallet/topup/account',
  walletTopUpInitiate: '/api/wallet/topup/initiate',
  health: '/api/health',
} as const;

/** Endpoints where a 401 means "bad credentials", not "session expired". */
const NO_REFRESH = new Set<string>([ENDPOINTS.login, ENDPOINTS.refresh, ENDPOINTS.register]);

const baseConfig = {
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeoutMs,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
};

export const http = create(baseConfig);

/** Bare instance for the refresh call so it never re-enters the interceptors. */
const refreshHttp = create(baseConfig);

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Let a 401 fail this request without refreshing or ending the session. */
    skipSessionHandling?: boolean;
  }
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

function handlesSession(config: RetriableConfig | undefined): config is RetriableConfig {
  return !!config && !config.skipSessionHandling && !NO_REFRESH.has(config.url ?? '');
}

http.interceptors.request.use((config) => {
  const tokens = session.getTokens();
  if (tokens && !NO_REFRESH.has(config.url ?? '')) {
    config.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  }
  return config;
});

/**
 * Single-flight refresh: when several requests fail with 401 at the same time
 * they all wait on one refresh call instead of each firing their own (which
 * would invalidate each other's refresh tokens if the server rotates them).
 */
let refreshInFlight: Promise<AuthTokens> | null = null;

export function refreshTokens(): Promise<AuthTokens> {
  const refreshToken = session.getTokens()?.refreshToken;
  if (!refreshToken) return Promise.reject(new Error('No refresh token'));

  refreshInFlight ??= refreshHttp
    .post(ENDPOINTS.refresh, { refresh_token: refreshToken })
    .then(async ({ data }) => {
      const next = parseTokens(data);
      // Some servers only rotate the access token; keep the old refresh token.
      const tokens = { ...next, refreshToken: next.refreshToken ?? refreshToken };
      await session.save(tokens);
      return tokens;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const isAuthFailure = error.response?.status === 401;

    if (isAuthFailure && handlesSession(config) && !config._retried) {
      config._retried = true;
      try {
        const tokens = await refreshTokens();
        config.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
        return http(config);
      } catch {
        await session.expire();
        return Promise.reject(toApiError(error));
      }
    }

    if (isAuthFailure && handlesSession(config)) {
      await session.expire();
    }
    const apiError = toApiError(error);
    // 13 Oct: a suspended or closed account answers 403 with a code; show the full-screen state.
    if (
      apiError.status === 403 &&
      (apiError.code === 'account_suspended' || apiError.code === 'account_closed')
    ) {
      accountState.set({
        kind: apiError.code === 'account_suspended' ? 'suspended' : 'closed',
        message: apiError.message,
      });
    }
    return Promise.reject(apiError);
  },
);
