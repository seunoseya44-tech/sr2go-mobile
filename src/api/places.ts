import type { Place } from './types';

/**
 * TEMPORARY place list until SR2Go supplies the Google Maps key. The search
 * endpoint needs coordinates, so From/To pick from these well-known Nigerian
 * cities and meeting areas. Replace with Google Places autocomplete (lat/lng
 * plus city name) once the key is restricted to our app IDs.
 */
export const PLACES: Place[] = [
  { name: 'Ojota, Lagos', city: 'Lagos', lat: 6.5874, lng: 3.3786 },
  { name: 'Berger, Lagos', city: 'Lagos', lat: 6.6433, lng: 3.3618 },
  { name: 'Ikeja, Lagos', city: 'Lagos', lat: 6.6018, lng: 3.3515 },
  { name: 'Lekki, Lagos', city: 'Lagos', lat: 6.4474, lng: 3.4723 },
  { name: 'Iyana Ipaja, Lagos', city: 'Lagos', lat: 6.6146, lng: 3.2956 },
  { name: 'Challenge, Ibadan', city: 'Ibadan', lat: 7.3509, lng: 3.8763 },
  { name: 'Iwo Road, Ibadan', city: 'Ibadan', lat: 7.4063, lng: 3.9325 },
  { name: 'Abeokuta', city: 'Abeokuta', lat: 7.1475, lng: 3.3619 },
  { name: 'Jabi, Abuja', city: 'Abuja', lat: 9.0643, lng: 7.4263 },
  { name: 'Utako, Abuja', city: 'Abuja', lat: 9.0696, lng: 7.4382 },
  { name: 'Kaduna', city: 'Kaduna', lat: 10.5105, lng: 7.4165 },
  { name: 'Lokoja', city: 'Lokoja', lat: 7.8023, lng: 6.7333 },
  { name: 'Benin City', city: 'Benin City', lat: 6.335, lng: 5.6037 },
  { name: 'Onitsha', city: 'Onitsha', lat: 6.1667, lng: 6.7833 },
  { name: 'Enugu', city: 'Enugu', lat: 6.4584, lng: 7.5464 },
  { name: 'Aba', city: 'Aba', lat: 5.1066, lng: 7.3667 },
  { name: 'Abakaliki', city: 'Abakaliki', lat: 6.3249, lng: 8.1137 },
  { name: 'Port Harcourt', city: 'Port Harcourt', lat: 4.8156, lng: 7.0498 },
  { name: 'Owerri', city: 'Owerri', lat: 5.4836, lng: 7.0333 },
  { name: 'Ilorin', city: 'Ilorin', lat: 8.4966, lng: 4.5421 },
  { name: 'Jos', city: 'Jos', lat: 9.8965, lng: 8.8583 },
  { name: 'Kano', city: 'Kano', lat: 12.0022, lng: 8.5919 },
];

export function searchPlaces(query: string): Place[] {
  const q = query.trim().toLowerCase();
  if (!q) return PLACES;
  return PLACES.filter((p) => p.name.toLowerCase().includes(q) || p.city.toLowerCase().includes(q));
}
