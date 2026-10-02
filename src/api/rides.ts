import { ENDPOINTS, http } from './client';
import { parseDriverProfile, parseRide, parseRides, parseTicker } from './parsers';
import type { DriverPublicProfile, Ride, RideSearchParams, TickerRoute } from './types';

export const ridesApi = {
  /** POST /api/rides/search. Returns the list of RideOut as ride cards. */
  async search(params: RideSearchParams): Promise<Ride[]> {
    const { data } = await http.post(ENDPOINTS.ridesSearch, {
      origin_lat: params.origin.lat,
      origin_lng: params.origin.lng,
      destination_lat: params.destination.lat,
      destination_lng: params.destination.lng,
      origin_city: params.origin.city,
      destination_city: params.destination.city,
      departure_date: params.date,
      seats_needed: params.seats,
      radius_km: params.radiusKm ?? 5,
    });
    return parseRides(data);
  },

  /** GET /api/rides/{ride_id}. */
  async get(rideId: string): Promise<Ride | null> {
    const { data } = await http.get(ENDPOINTS.ride(rideId));
    return parseRide(data);
  },

  /** GET /api/drivers/{driver_id}/public. Build only the fields it returns. */
  async driverProfile(driverId: string): Promise<DriverPublicProfile> {
    const { data } = await http.get(ENDPOINTS.driverPublic(driverId));
    return parseDriverProfile(data);
  },

  /** GET /api/v1/pricing/ticker: popular routes with price, anchor and savings. */
  async ticker(): Promise<TickerRoute[]> {
    const { data } = await http.get(ENDPOINTS.pricingTicker, { skipSessionHandling: true });
    return parseTicker(data);
  },
};
