import { useSyncExternalStore } from 'react';

/**
 * Account suspended / closed (13 Oct). Set by the HTTP layer when the backend
 * answers 403 `account_suspended` or `account_closed`; the navigator then shows
 * the matching full-screen state instead of the app.
 */
export type AccountState = { kind: 'ok' } | { kind: 'suspended' | 'closed'; message: string };

let state: AccountState = { kind: 'ok' };
const listeners = new Set<() => void>();

export const accountState = {
  get: () => state,
  set(next: AccountState) {
    state = next;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export function useAccountState(): AccountState {
  return useSyncExternalStore(accountState.subscribe, accountState.get, accountState.get);
}
