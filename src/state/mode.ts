import { useSyncExternalStore } from 'react';

/**
 * Which tab bar the signed-in user sees. A driver can switch to "Travelling"
 * (the passenger tabs) and back; passengers only see the passenger tabs
 * until their vehicle is approved.
 */
export type AppMode = 'passenger' | 'driver';

let mode: AppMode = 'passenger';
const listeners = new Set<() => void>();

export const appMode = {
  get: () => mode,
  set(next: AppMode) {
    if (next === mode) return;
    mode = next;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export function useAppMode(): AppMode {
  return useSyncExternalStore(appMode.subscribe, appMode.get, appMode.get);
}
