import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Thin wrapper over the platform keystore (iOS Keychain / Android Keystore).
 * Tokens are never written to AsyncStorage, which is unencrypted.
 *
 * On web (dev preview only) SecureStore isn't available, so we fall back to an
 * in-memory map: the session simply won't survive a reload there.
 */

const memory = new Map<string, string>();
const useMemory = Platform.OS === 'web';

const OPTIONS: SecureStore.SecureStoreOptions = {
  // Readable once the device has been unlocked after boot, never synced to
  // iCloud / other devices.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    if (useMemory) return memory.get(key) ?? null;
    try {
      return await SecureStore.getItemAsync(key, OPTIONS);
    } catch {
      // A corrupted keystore entry (e.g. after a device restore) must not
      // crash the app on launch; treat it as "no session".
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    if (useMemory) {
      memory.set(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value, OPTIONS);
  },

  async remove(key: string): Promise<void> {
    if (useMemory) {
      memory.delete(key);
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key, OPTIONS);
    } catch {
      // Nothing to delete is not an error.
    }
  },
};
