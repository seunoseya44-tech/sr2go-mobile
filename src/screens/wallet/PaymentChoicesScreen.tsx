import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { paymentChoicesApi, type PayoutTarget } from '../../api/paymentChoices';
import { toApiError } from '../../api/errors';
import { Banner } from '../../components/Banner';
import { Screen } from '../../components/Screen';
import { colors, radius, spacing, typography } from '../../theme';
import { shared } from '../booking/shared';

/**
 * Profile → Payments (item 7, 31 Oct): where driver earnings and refunds go.
 * Drivers see both choices, passengers only Refunds. The explanation under
 * each option is the server's own text.
 */
export function PaymentChoicesScreen() {
  const queryClient = useQueryClient();
  const [note, setNote] = useState<string | null>(null);
  const prefs = useQuery({ queryKey: ['payment-choices'], queryFn: paymentChoicesApi.get });
  const save = useMutation({
    mutationFn: paymentChoicesApi.set,
    onMutate: () => setNote(null),
    onSuccess: (p) => {
      queryClient.setQueryData(['payment-choices'], p);
      setNote('Saved.');
    },
    onError: (e) => setNote(toApiError(e).message),
  });
  const p = prefs.data;

  return (
    <Screen testID="payment-choices" topBar={{ title: 'Payments' }}>
      {note ? (
        <Banner
          tone={save.isError ? 'error' : 'success'}
          message={note}
          onDismiss={() => setNote(null)}
        />
      ) : null}
      {prefs.isPending ? <ActivityIndicator color={colors.brand} /> : null}
      {prefs.isError ? <Banner tone="error" message={toApiError(prefs.error).message} /> : null}
      {p ? (
        <>
          {p.isDriver ? (
            <Choice
              title="Trip earnings"
              value={p.driverEarnings}
              options={[
                { value: 'bank', label: 'To my bank account', explain: p.explain.earningsBank },
                { value: 'wallet', label: 'To my SR2Go wallet', explain: p.explain.earningsWallet },
              ]}
              busy={save.isPending}
              onChange={(v) => save.mutate({ driverEarnings: v })}
            />
          ) : null}
          <Choice
            title="Refunds"
            value={p.refunds}
            options={[
              { value: 'wallet', label: 'To my SR2Go wallet', explain: p.explain.refundsWallet },
              { value: 'bank', label: 'To my bank account', explain: p.explain.refundsBank },
            ]}
            busy={save.isPending}
            onChange={(v) => save.mutate({ refunds: v })}
          />
          {p.explain.general ? <Text style={shared.subtitle}>{p.explain.general}</Text> : null}
        </>
      ) : null}
    </Screen>
  );
}

function Choice({
  title,
  value,
  options,
  busy,
  onChange,
}: {
  title: string;
  value: PayoutTarget | null;
  options: { value: PayoutTarget; label: string; explain: string | null }[];
  busy: boolean;
  onChange: (v: PayoutTarget) => void;
}) {
  return (
    <View style={styles.group}>
      <Text style={shared.overline}>{title}</Text>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => !on && !busy && onChange(o.value)}
            style={[styles.option, on && styles.optionOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled: busy }}
          >
            <Ionicons
              name={on ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={on ? colors.brand : colors.textMuted}
            />
            <View style={styles.flex}>
              <Text style={styles.label}>{o.label}</Text>
              {o.explain ? <Text style={shared.subtitle}>{o.explain}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  group: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionOn: { borderColor: colors.brand, borderWidth: 2, backgroundColor: colors.brandSoft },
  label: { ...typography.bodySemibold, color: colors.text },
});
