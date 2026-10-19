/**
 * Encryption for the boarding pack and photos (16 Oct note: app-private
 * storage, encrypted so files cannot be opened outside the app). AES-256-GCM
 * in pure JS; the key lives in the platform keystore via expo-secure-store.
 */
import { gcm } from '@noble/ciphers/aes';
import * as Crypto from 'expo-crypto';

import { secureStorage } from '../storage/secureStorage';

const KEY_NAME = 'sr2go.boarding.key';
let cached: Uint8Array | null = null;

export function toB64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return globalThis.btoa(bin);
}

export function fromB64(b64: string): Uint8Array {
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function key(): Promise<Uint8Array> {
  if (cached) return cached;
  const stored = await secureStorage.get(KEY_NAME);
  if (stored) {
    cached = fromB64(stored);
    return cached;
  }
  const fresh = Crypto.getRandomBytes(32);
  await secureStorage.set(KEY_NAME, toB64(fresh));
  cached = fresh;
  return fresh;
}

/** nonce (12 bytes) + ciphertext+tag, base64. */
export async function encrypt(plain: Uint8Array): Promise<string> {
  const k = await key();
  const nonce = Crypto.getRandomBytes(12);
  const sealed = gcm(k, nonce).encrypt(plain);
  const out = new Uint8Array(nonce.length + sealed.length);
  out.set(nonce, 0);
  out.set(sealed, nonce.length);
  return toB64(out);
}

export async function decrypt(b64: string): Promise<Uint8Array> {
  const k = await key();
  const all = fromB64(b64);
  const nonce = all.subarray(0, 12);
  return gcm(k, nonce).decrypt(all.subarray(12));
}

export const utf8 = {
  encode: (s: string) => new TextEncoder().encode(s),
  decode: (b: Uint8Array) => new TextDecoder().decode(b),
};
