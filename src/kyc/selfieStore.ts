/**
 * Keeps the live selfie for one hour (joint test fix 2, 29 Oct). Each selfie
 * check costs money, so going back to fix the date of birth, leaving the app
 * or reopening the identity check within the hour re-uses this selfie instead
 * of asking for a new one. Encrypted in the app's private folder; deleted
 * after the hour, on successful verification and on sign-out.
 */
import * as FS from 'expo-file-system/legacy';

import { decrypt, encrypt, utf8 } from '../boarding/crypto';
import { appConfig } from '../config/appConfig';

/** The server's free retry window (selfie_retry_minutes, release 109: 60). */
const ttlMs = () => appConfig().selfieRetryMinutes * 60_000;

const FILE = `${FS.documentDirectory ?? ''}kyc-selfie.enc`;

interface Stored {
  at: number;
  base64: string;
}

export async function saveSelfie(base64: string, now = Date.now()): Promise<void> {
  const body: Stored = { at: now, base64 };
  await FS.writeAsStringAsync(FILE, await encrypt(utf8.encode(JSON.stringify(body))), {
    encoding: 'utf8',
  });
}

/** The stored selfie when it is less than an hour old; deletes an expired one. */
export async function loadSelfie(now = Date.now()): Promise<Stored | null> {
  try {
    const info = await FS.getInfoAsync(FILE);
    if (!info.exists) return null;
    const s = JSON.parse(
      utf8.decode(await decrypt(await FS.readAsStringAsync(FILE, { encoding: 'utf8' }))),
    ) as Stored;
    if (typeof s.base64 !== 'string' || typeof s.at !== 'number' || now - s.at > ttlMs()) {
      await clearSelfie();
      return null;
    }
    return s;
  } catch {
    await clearSelfie();
    return null;
  }
}

export async function clearSelfie(): Promise<void> {
  await FS.deleteAsync(FILE, { idempotent: true }).catch(() => undefined);
}
