import { useSyncExternalStore } from 'react';

import type { Place } from '../api/types';
import { addDays, isoDate } from '../utils/format';

/**
 * The Home search form, kept outside React so the place picker (a separate
 * screen) can write back into it without prop drilling or route params.
 */
export interface SearchForm {
  origin: Place | null;
  destination: Place | null;
  date: string;
  seats: number;
}

let state: SearchForm = { origin: null, destination: null, date: addDays(isoDate(), 1), seats: 1 };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const searchForm = {
  get: () => state,
  set(patch: Partial<SearchForm>) {
    state = { ...state, ...patch };
    emit();
  },
  swap() {
    state = { ...state, origin: state.destination, destination: state.origin };
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Test helper. */
  reset() {
    state = { origin: null, destination: null, date: addDays(isoDate(), 1), seats: 1 };
    emit();
  },
};

export function useSearchForm(): SearchForm {
  return useSyncExternalStore(searchForm.subscribe, searchForm.get, searchForm.get);
}
