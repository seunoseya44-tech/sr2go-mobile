/** Boarding pack shapes from the 16 Oct 2026 update (GET /api/boarding/pack/...). */

export interface PackKey {
  alg: string;
  kid: string;
  /** raw 32 bytes, base64url, no padding */
  publicKey: string;
  tokenPrefix: string;
}

export interface BoardingFlags {
  driverCheckedPassengerCode: boolean;
  passengerCheckedDriverCode: boolean;
  driverConfirmedFace: boolean;
  passengerConfirmedFace: boolean;
  boarded: boolean;
  heldForReview: boolean;
}

export interface Vehicle {
  make: string | null;
  model: string | null;
  colour: string | null;
  plate: string | null;
}

export interface PassengerPack {
  bookingId: string;
  rideId: string;
  departureTime: string | null;
  expiresAt: string | null;
  packVersion: string;
  key: PackKey;
  /** The token to draw as this passenger's QR. */
  myQr: string;
  /** 4 digits for the driver to type. Online only. */
  boardingCode: string | null;
  seatsBooked: number | null;
  driver: {
    userId: string;
    name: string | null;
    verified: boolean;
    /** 30-minute link: download at once, then store encrypted. */
    photo: string | null;
    vehicle: Vehicle;
  };
  boarding: BoardingFlags;
  supportPhone: string;
  /** Seconds to add to the phone clock to get server time. */
  clockOffsetSeconds: number;
}

export interface DriverPackPassenger {
  bookingId: string;
  passengerId: string;
  name: string | null;
  verified: boolean;
  photo: string | null;
  seatsBooked: number | null;
  children: number;
  /** Code the driver shows for typed fallback (online only). */
  driverCode: string | null;
  heldForReview: boolean;
  boarding: BoardingFlags;
}

export interface DriverPack {
  rideId: string;
  departureTime: string | null;
  expiresAt: string | null;
  packVersion: string;
  key: PackKey;
  /** The ONE token every passenger scans. */
  tripQr: string;
  passengers: DriverPackPassenger[];
  supportPhone: string;
  clockOffsetSeconds: number;
}

/** Fallback until `support_phone` is in every pack (SR2Go, 16 Oct). */
export const SUPPORT_PHONE_FALLBACK = '+2349053451158';

export type SyncSide = 'driver' | 'passenger';

export interface SyncEvent {
  eventId: string;
  bookingId: string;
  side: SyncSide;
  /** The QR text that was scanned. */
  scanned: string;
  faceMatched: boolean | null;
  reason: string | null;
  /** ISO time from the phone clock. */
  phoneTime: string;
}

export type SyncStatus = 'applied' | 'applied_late' | 'recorded_late' | 'duplicate' | 'refused';

export interface SyncAnswer {
  eventId: string;
  status: SyncStatus;
  error: string | null;
}
