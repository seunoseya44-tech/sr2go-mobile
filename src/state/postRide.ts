import { useSyncExternalStore } from 'react';

import type { MeetingPoint } from '../api/driver';
import type { Place, Preference } from '../api/types';
import { addDays, isoDate } from '../utils/format';

/** The three-step Post a ride form, kept outside React like the search form. */
export interface PostRideForm {
  origin: Place | null;
  destination: Place | null;
  date: string;
  time: string;
  seats: number;
  car: string;
  meetingPoint: MeetingPoint | null;
  ownMeetingPoint: string;
  driverPrice: string;
  priceAcknowledged: boolean;
  autoApprove: boolean;
  isAc: boolean;
  prefMusic: Preference;
  prefPets: Preference;
  prefChat: Preference;
  prefSmoking: Preference;
  driverSmokes: boolean;
  maxLuggageKg: string;
  luggageNote: string;
  notes: string;
}

const initial = (): PostRideForm => ({
  origin: null,
  destination: null,
  date: addDays(isoDate(), 1),
  time: '07:00',
  seats: 4,
  car: '',
  meetingPoint: null,
  ownMeetingPoint: '',
  driverPrice: '',
  priceAcknowledged: false,
  autoApprove: true,
  isAc: false,
  prefMusic: 'yes',
  prefPets: 'ask',
  prefChat: 'yes',
  prefSmoking: 'no',
  driverSmokes: false,
  maxLuggageKg: '20',
  luggageNote: '',
  notes: '',
});

let state = initial();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const postRide = {
  get: () => state,
  set(patch: Partial<PostRideForm>) {
    state = { ...state, ...patch };
    emit();
  },
  reset() {
    state = initial();
    emit();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export function usePostRide(): PostRideForm {
  return useSyncExternalStore(postRide.subscribe, postRide.get, postRide.get);
}
