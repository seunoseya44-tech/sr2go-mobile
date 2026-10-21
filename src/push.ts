/**
 * Push notifications (Firebase project sr2go-f46f0, file received 20 Oct).
 * The device FCM token goes to PUT /api/auth/fcm-token once per session.
 * Taps on a notification open the matching screen from `data.type`.
 */
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';

import { ENDPOINTS, http } from './api/client';
import { flushSync, syncPacks } from './boarding/manager';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PushNavigator = (type: string, data: Record<string, unknown>) => void;

async function registerToken(): Promise<void> {
  if (!Device.isDevice) return;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'SR2Go',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const token = (await Notifications.getDevicePushTokenAsync()).data;
  if (typeof token === 'string' && token) {
    await http.put(ENDPOINTS.fcmToken, { fcm_token: token });
  }
}

/** Mount once while signed in. `navigate` is called with the push's data.type. */
export function usePushNotifications(enabled: boolean, navigate: PushNavigator) {
  const queryClient = useQueryClient();
  const nav = useRef(navigate);

  useEffect(() => {
    nav.current = navigate;
  }, [navigate]);

  useEffect(() => {
    if (!enabled) return;
    void registerToken().catch(() => undefined);

    const onData = (data: Record<string, unknown>) => {
      const type = String(data.type ?? '');
      // Every booking/ride push can change a list the user is looking at.
      void queryClient.invalidateQueries();
      if (type === 'wallet_topup') void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      if (type === 'boarding_pack' || type === 'payment_received' || /cancel/.test(type)) {
        void syncPacks();
        void flushSync();
      }
    };

    const received = Notifications.addNotificationReceivedListener((n) => {
      onData((n.request.content.data ?? {}) as Record<string, unknown>);
    });
    const tapped = Notifications.addNotificationResponseReceivedListener((r) => {
      const data = (r.notification.request.content.data ?? {}) as Record<string, unknown>;
      onData(data);
      nav.current(String(data.type ?? ''), data);
    });
    return () => {
      received.remove();
      tapped.remove();
    };
  }, [enabled, queryClient]);
}
