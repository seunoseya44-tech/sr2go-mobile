import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';

import { walletMoneyApi } from '../api/walletMoney';
import { listPendingTopUps, removePendingTopUp } from './pendingTopUps';

/**
 * While the screen is shown (and each time the app comes back to the front),
 * ask the server about every card top-up still open on this phone. A confirmed
 * one is removed, the balance is refreshed and onCredited gets its amounts, so
 * the user sees "N... added" instead of paying again (field test, 6 Nov 2026).
 */
export function useConfirmPendingTopUps(onCredited?: (amounts: number[]) => void): void {
  const queryClient = useQueryClient();
  const running = useRef(false);
  const callback = useRef(onCredited);
  useEffect(() => {
    callback.current = onCredited;
  }, [onCredited]);

  useFocusEffect(
    useCallback(() => {
      let shown = true;
      const check = async () => {
        if (running.current) return;
        running.current = true;
        try {
          const pending = await listPendingTopUps();
          const credited: number[] = [];
          for (const p of pending) {
            try {
              const v = await walletMoneyApi.verifyTopUp(p.reference);
              if (v.credited) {
                credited.push(Number(p.amount) || 0);
                await removePendingTopUp(p.reference);
              }
            } catch {
              // No signal or the server is busy: try again next time.
            }
          }
          if (credited.length) {
            void queryClient.invalidateQueries({ queryKey: ['wallet'] });
            void queryClient.invalidateQueries({ queryKey: ['wallet-activity'] });
            if (shown) callback.current?.(credited);
          }
        } finally {
          running.current = false;
        }
      };
      void check();
      const sub = AppState.addEventListener('change', (s) => {
        if (s === 'active') void check();
      });
      return () => {
        shown = false;
        sub.remove();
      };
    }, [queryClient]),
  );
}
