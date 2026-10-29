export interface AuthTokens {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
}

/**
 * The subset of the user profile the app relies on. The backend may return
 * more fields; unknown ones are kept in `raw` so nothing is lost.
 */
export interface User {
  id: string | null;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  role: string | null;
  phoneVerified: boolean | null;
  /** is_verified / identity_verified: identity check passed AND selfie stored. Drives the Verified badge. */
  isVerified: boolean | null;
  ninVerified: boolean | null;
  bankVerified: boolean | null;
  raw: Record<string, unknown>;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResult {
  tokens: AuthTokens;
  user: User | null;
}

export type SignUpRole = 'passenger' | 'driver';

export interface RegisterPayload {
  fullName: string;
  email: string;
  /** E.164, e.g. +2348031234521. */
  phone: string;
  password: string;
  role: SignUpRole;
  referralCode?: string;
}

/** A place with coordinates, as the search endpoint needs lat/lng. */
export interface Place {
  name: string;
  /** "Lagos, Lagos" under the name when the city differs (21 Oct place search). */
  detail?: string;
  /** SR2Go changeover hub. */
  hub?: boolean;
  /** `map` = a map place (streets, junctions, villages) rather than an SR2Go town or hub. */
  source?: 'sr2go' | 'map';
  /** City name sent alongside coordinates (e.g. "Lagos"). */
  city: string;
  lat: number;
  lng: number;
}

export interface RideSearchParams {
  origin: Place;
  destination: Place;
  /** YYYY-MM-DD */
  date: string;
  seats: number;
  radiusKm?: number;
}

export type VehicleType = 'Saloon' | 'Sienna' | 'Hiace' | string;
export type Preference = 'yes' | 'no' | 'ask' | null;

/**
 * A ride as shown on cards and the details screen. Money arrives as strings
 * and is kept as strings: the app never calculates a price.
 */
export interface Ride {
  id: string;
  departureTime: string | null;
  departureDate: string | null;
  originCity: string | null;
  destinationCity: string | null;
  vehicleType: VehicleType | null;
  seatsLeft: number | null;
  meetingPointName: string | null;
  meetingPointAddress: string | null;
  meetingPointLat: number | null;
  meetingPointLng: number | null;
  driverId: string | null;
  /** Already shortened by the API, e.g. "Chinedu.O". */
  driverName: string | null;
  driverRating: number | null;
  driverTripsCompleted: number | null;
  /** driver_verified: show the Verified badge next to the name. Ride cards never carry a driver photo. */
  driverVerified: boolean;
  /** The bold price a passenger pays. */
  payAmount: string | null;
  /** Crossed-out usual fare; null on city trips. */
  usualFare: string | null;
  savingsPct: number | null;
  autoApprove: boolean;
  isAc: boolean;
  driverSmokes: boolean;
  prefMusic: Preference;
  prefPets: Preference;
  prefChat: Preference;
  prefSmoking: Preference;
  maxLuggageKg: number | null;
  luggageNote: string | null;
  notes: string | null;
  raw: Record<string, unknown>;
}

export interface DriverPublicProfile {
  id: string | null;
  name: string | null;
  memberSince: string | null;
  rating: number | null;
  tripsCompleted: number | null;
  isVerified: boolean;
  badges: string[];
  vehicle: string | null;
  raw: Record<string, unknown>;
}

/** A popular route from GET /api/v1/pricing/ticker. */
export interface TickerRoute {
  origin: string;
  destination: string;
  price: string;
  motorParkAnchor: string | null;
  savingsPct: number | null;
}
