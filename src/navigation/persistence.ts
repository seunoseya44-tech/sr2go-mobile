/**
 * Field test, 6 Nov: on many Android phones the system closes the app while
 * the user is in WhatsApp or on the Paystack page, and the app then opened on
 * Home. The navigation state is now saved on every screen change and restored
 * on the next start, so the user comes back to the screen they left. Saved in
 * the app's private folder; kept 30 minutes; cleared on sign-out.
 */
import * as FS from 'expo-file-system/legacy';
import type { NavigationState } from '@react-navigation/native';

const FILE = `${FS.documentDirectory ?? ''}nav-state.json`;
const MAX_AGE_MS = 30 * 60_000;

export async function loadNavState(): Promise<NavigationState | undefined> {
  try {
    const info = await FS.getInfoAsync(FILE);
    if (!info.exists) return undefined;
    const saved = JSON.parse(await FS.readAsStringAsync(FILE)) as {
      at: number;
      state: NavigationState;
    };
    if (!saved?.state || Date.now() - saved.at > MAX_AGE_MS) return undefined;
    return saved.state;
  } catch {
    return undefined;
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Debounced: screens change quickly during a flow. */
export function saveNavState(state: NavigationState | undefined): void {
  if (!state) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void FS.writeAsStringAsync(FILE, JSON.stringify({ at: Date.now(), state })).catch(
      () => undefined,
    );
  }, 400);
}

export async function clearNavState(): Promise<void> {
  if (timer) clearTimeout(timer);
  await FS.deleteAsync(FILE, { idempotent: true }).catch(() => undefined);
}
