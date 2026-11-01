import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  walletMoneyApi,
  withdrawalStatusText,
  type WithdrawResult,
  type WithdrawStarted,
} from '../../api/walletMoney';
import { toApiError } from '../../api/errors';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { InfoBanner } from '../../components/ui';
import { appConfig } from '../../config/appConfig';
import type { AppStackParamList } from '../../navigation/types';
import { colors, radius, spacing, typography } from '../../theme';
import { naira, shortDate } from '../../utils/format';
import { ResultIcon, shared } from '../booking/shared';

type Nav = NativeStackNavigationProp<AppStackParamList>;

/**
 * W3 · Withdraw wallet money to the user's own verified bank (release 116).
 * Two factors: his password, then a one-time code sent to his phone (email
 * if SMS fails). Only his own money: ride credit is never withdrawable.
 * The fee, limits and holds are the server's; the app only shows them.
 */
export function WithdrawScreen() {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const cfg = appConfig();
  const info = useQuery({ queryKey: ['withdraw-info'], queryFn: walletMoneyApi.withdrawInfo });
  const [amount, setAmount] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [started, setStarted] = useState<WithdrawStarted | null>(null);
  const [result, setResult] = useState<WithdrawResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsBank, setNeedsBank] = useState(false);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    void queryClient.invalidateQueries({ queryKey: ['wallet-activity'] });
    void queryClient.invalidateQueries({ queryKey: ['withdraw-info'] });
  };

  const start = useMutation({
    mutationFn: () => walletMoneyApi.withdrawStart(amount, password),
    onMutate: () => setError(null),
    onSuccess: (s) => {
      setStarted(s);
      setPassword('');
      setCode('');
    },
    onError: (e) => {
      const err = toApiError(e);
      setError(err.message);
      if (err.code === 'no_bank') setNeedsBank(true);
    },
  });

  const confirm = useMutation({
    mutationFn: () => walletMoneyApi.withdrawConfirm(started!.withdrawalId, code),
    onMutate: () => setError(null),
    onSuccess: (r) => {
      setResult(r);
      refresh();
    },
    onError: (e) => {
      const err = toApiError(e);
      if (err.code === 'wrong_code') {
        const left = err.extra.triesLeft;
        setError(
          left != null
            ? `${err.message} ${left} ${left === 1 ? 'try' : 'tries'} left.`
            : err.message,
        );
        setCode('');
        return;
      }
      // Expired, too many tries, no longer waiting: this request is over; start again.
      setError(err.message);
      setStarted(null);
      setCode('');
      refresh();
    },
  });

  const i = info.data;
  const n = Number(amount);
  const min = i?.min ?? cfg.withdrawMin;
  const amountError =
    amount && i
      ? n < min
        ? `The smallest withdrawal is ${naira(min)}.`
        : n > i.withdrawable
          ? `You can withdraw up to ${naira(i.withdrawable)} now.`
          : undefined
      : undefined;

  if (result) {
    const failed = result.status === 'failed' || result.status === 'returned';
    return (
      <Screen
        testID="withdraw"
        topBar={{ leading: 'close', onLeadingPress: () => navigation.goBack() }}
        footer={<Button title="Back to wallet" onPress={() => navigation.goBack()} />}
      >
        <View style={shared.centered}>
          <ResultIcon
            icon={failed ? 'close' : result.status === 'paid' ? 'checkmark' : 'time-outline'}
            tone={failed ? 'red' : 'blue'}
          />
          <Text style={shared.heading}>{withdrawalStatusText(result.status)}</Text>
          <Text style={shared.body}>
            {result.message ??
              (started
                ? `${naira(started.youReceive ?? '')} is on its way to ${started.bank ?? 'your bank'}. Banks usually show it within minutes, sometimes up to 24 hours.`
                : '')}
          </Text>
        </View>
      </Screen>
    );
  }

  if (started) {
    return (
      <Screen
        testID="withdraw-code"
        topBar={{ title: 'Enter your code' }}
        footer={
          <>
            <Button
              title={`Withdraw ${naira(started.amount ?? amount)}`}
              onPress={() => confirm.mutate()}
              disabled={code.length !== 6}
              loading={confirm.isPending}
              testID="withdraw-confirm"
            />
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => {
                setStarted(null);
                setError(null);
              }}
            />
          </>
        }
      >
        {error ? <Banner tone="error" message={error} onDismiss={() => setError(null)} /> : null}
        <View style={styles.summary}>
          <Row label="From your wallet" value={naira(started.amount ?? amount)} />
          <Row label="Transfer fee (Paystack)" value={`−${naira(started.fee ?? 0)}`} />
          <View style={styles.divider} />
          <Row label="You receive" value={naira(started.youReceive ?? '')} strong />
          <Row label="To" value={started.bank ?? '—'} />
        </View>
        <Text style={styles.body}>
          We sent a 6-digit code to your {started.codeSentTo === 'email' ? 'email' : 'phone'}. It
          works for {started.expiresInMinutes ?? cfg.withdrawCodeMinutes} minutes.
        </Text>
        <TextField
          label="6-digit code"
          keyboardType="number-pad"
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
          autoFocus
          testID="withdraw-code-input"
        />
        {started.sandboxCode ? (
          <Text style={shared.subtitle}>Test server code: {started.sandboxCode}</Text>
        ) : null}
        <View style={styles.row}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.textMuted} />
          <Text style={styles.helperFlex}>
            SR2Go never asks for this code by phone or chat. If you did not ask to withdraw, do not
            enter it and call SR2Go support.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      testID="withdraw"
      topBar={{ title: 'Withdraw' }}
      footer={
        needsBank ? (
          <Button title="Add my bank account" onPress={() => navigation.navigate('KycBank')} />
        ) : (
          <Button
            title="Send me a code"
            onPress={() => start.mutate()}
            disabled={!i || !amount || !!amountError || password.length < 6}
            loading={start.isPending}
            testID="withdraw-start"
          />
        )
      }
    >
      {error ? <Banner tone="error" message={error} onDismiss={() => setError(null)} /> : null}
      {info.isPending ? <ActivityIndicator color={colors.brand} /> : null}
      {info.isError ? <Banner tone="error" message={toApiError(info.error).message} /> : null}
      {i ? (
        <>
          <View style={styles.summary}>
            <Text style={shared.overline}>You can withdraw now</Text>
            <Text style={styles.big}>{naira(i.withdrawable)}</Text>
            <Text style={shared.subtitle}>
              To: {i.bank ?? 'no bank account yet (add one in Profile)'}
            </Text>
          </View>
          {i.heldCardMoney > 0 ? (
            <InfoBanner>
              {naira(i.heldCardMoney)} came from a card and can be withdrawn{' '}
              {i.cardHoldDays ?? cfg.cardHoldDays} days after it arrived. You can use it for seats
              now.
            </InfoBanner>
          ) : null}
          <TextField
            label="Amount"
            prefix={cfg.currencySymbol}
            keyboardType="number-pad"
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/\D/g, ''))}
            helper={`Smallest ${naira(min)}${i.dailyMax ? ` · up to ${naira(i.dailyMax)} a day` : ''}. Paystack's transfer fee is taken from it.`}
            error={amountError}
            testID="withdraw-amount"
          />
          <TextField
            label="Your SR2Go password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            testID="withdraw-password"
          />
          <Text style={shared.subtitle}>
            {i.note ??
              'Only your own money can be withdrawn, to your own bank account. Ride credit is used for rides only.'}
          </Text>
          {i.withdrawals.length ? <Text style={shared.overline}>Your withdrawals</Text> : null}
          {i.withdrawals.map((w) => (
            <View key={w.id} style={styles.item}>
              <View style={styles.flex}>
                <Text style={styles.body}>{withdrawalStatusText(w.status)}</Text>
                <Text style={shared.subtitle}>
                  {[w.createdAt ? shortDate(w.createdAt) : null, w.bank]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Text style={styles.amount}>{naira(w.amount ?? '')}</Text>
            </View>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.kv}>
      <Text style={strong ? styles.semi : styles.body}>{label}</Text>
      <Text style={strong ? styles.semi : styles.body}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: {
    backgroundColor: colors.tile,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  big: { ...typography.price, color: colors.navy },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xxs },
  body: { ...typography.body, color: colors.text },
  semi: { ...typography.bodySemibold, color: colors.text },
  row: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
  helperFlex: { ...typography.secondary, color: colors.textMuted, flex: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  amount: { ...typography.bodySemibold, color: colors.text, fontVariant: ['tabular-nums'] },
});
