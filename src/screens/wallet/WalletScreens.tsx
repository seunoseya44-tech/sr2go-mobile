import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';

import { walletApi, type GiftRecipient } from '../../api/account';
import { toApiError } from '../../api/errors';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { Avatar, Card, InfoBanner, LinkText, ListRow } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { colors, fonts, radius, spacing, typography } from '../../theme';
import { naira, shortDate } from '../../utils/format';
import { ResultIcon, shared } from '../booking/shared';

type Nav = NativeStackNavigationProp<AppStackParamList>;

/** Screen 44 · Wallet with Top up and Send credit (13 Oct: build now). */
export function WalletScreen() {
  const navigation = useNavigation<Nav>();
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: walletApi.wallet });
  const w = wallet.data;
  return (
    <Screen topBar={null} testID="wallet-screen">
      <Text style={styles.title}>Wallet</Text>
      <View style={styles.balance}>
        <Text style={styles.balanceLabel}>RIDE CREDITS</Text>
        <Text style={styles.balanceAmount}>
          {wallet.isPending ? '…' : w?.balance ? naira(w.balance) : '₦0'}
        </Text>
        <Text style={styles.balanceSub}>Use them to pay for your next ride</Text>
      </View>
      <View style={styles.twoUp}>
        <Button
          title="Top up"
          variant="secondary"
          icon="add-circle-outline"
          onPress={() => navigation.navigate('TopUp')}
          style={styles.flex}
        />
        <Button
          title="Send credit"
          variant="secondary"
          icon="paper-plane-outline"
          onPress={() => navigation.navigate('SendCredit')}
          style={styles.flex}
        />
      </View>
      <View style={styles.row}>
        <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
        <Text style={styles.helperFlex}>
          {w?.expiryNote ??
            "Ride credits aren't cash and can't be withdrawn. They expire 12 months after you earn them."}
        </Text>
      </View>
      <Card onPress={() => navigation.navigate('Invite')} testID="invite-card">
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.semi}>Invite friends, earn ride credits</Text>
            <Text style={shared.subtitle}>
              Earn credits every time a friend you invite travels.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSubtle} />
        </View>
      </Card>
      {wallet.isError ? <Banner tone="error" message={toApiError(wallet.error).message} /> : null}
      <Text style={shared.overline}>Activity</Text>
      {w && w.activity.length === 0 ? (
        <Text style={shared.subtitle}>No credit activity yet.</Text>
      ) : null}
      {w?.activity.map((a) => {
        const negative =
          (a.amount ?? '').startsWith('-') ||
          /used|expired|sent|debit/i.test(`${a.type} ${a.description}`);
        return (
          <View key={a.id} style={styles.activity}>
            <View style={styles.flex}>
              <Text style={styles.body}>{a.description}</Text>
              {a.date ? <Text style={shared.subtitle}>{shortDate(a.date)}</Text> : null}
            </View>
            <Text style={[styles.amount, { color: negative ? colors.text : colors.navy }]}>
              {negative && !(a.amount ?? '').startsWith('-') ? '−' : ''}
              {naira((a.amount ?? '').replace('-', ''))}
            </Text>
          </View>
        );
      })}
    </Screen>
  );
}

/** Screen 45 · Invite friends. */
export function InviteScreen() {
  const dash = useQuery({ queryKey: ['referral'], queryFn: walletApi.dashboard });
  const gen = useMutation({ mutationFn: walletApi.generateCode });
  const code = gen.data ?? dash.data?.code ?? null;
  const [copied, setCopied] = useState(false);
  const message =
    dash.data?.shareMessage ??
    (code
      ? `Join me on SR2Go, the safer way to share long-distance rides in Nigeria. Use my code ${code} when you sign up: https://shareride2go.com`
      : '');
  return (
    <Screen testID="invite" topBar={{ title: 'Invite friends' }}>
      <Text style={shared.heading}>Invite friends, earn ride credits</Text>
      <Text style={styles.body}>
        When a friend signs up with your code, you earn ride credits each time they travel with
        SR2Go.
      </Text>
      <View style={styles.codeTile}>
        <Text style={shared.overline}>Your code</Text>
        {dash.isPending ? (
          <ActivityIndicator color={colors.brand} />
        ) : code ? (
          <Text style={styles.code}>{code}</Text>
        ) : (
          <Button
            title="Get my code"
            variant="secondary"
            onPress={() => gen.mutate()}
            loading={gen.isPending}
          />
        )}
        {code ? (
          <LinkText
            onPress={() => {
              void Clipboard.setStringAsync(code);
              setCopied(true);
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </LinkText>
        ) : null}
      </View>
      {dash.isError ? <Banner tone="error" message={toApiError(dash.error).message} /> : null}
      <Button
        title="Share invite"
        icon="share-social-outline"
        onPress={() => void Share.share({ message })}
        disabled={!code}
      />
      <View style={styles.stats}>
        {[
          [dash.data?.friendsJoined ?? '—', 'Friends joined'],
          [dash.data?.travelled ?? '—', 'Have travelled'],
          [dash.data?.creditsEarned ? naira(dash.data.creditsEarned) : '—', 'Credits earned'],
        ].map(([v, l]) => (
          <View key={String(l)} style={styles.stat}>
            <Text style={styles.statValue}>{String(v)}</Text>
            <Text style={shared.subtitle}>{l}</Text>
          </View>
        ))}
      </View>
      {dash.data?.milestone ? (
        <>
          <Text style={shared.overline}>Next milestone</Text>
          <View style={styles.tile}>
            <Text style={styles.body}>{dash.data.milestone}</Text>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

/** W1 · Send credit: phone look-up, confirm the person, amount. */
export function SendCreditScreen() {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: walletApi.wallet });
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState<GiftRecipient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const e164 = `+234${phone.replace(/\D/g, '')}`;

  const lookup = useMutation({
    mutationFn: () => walletApi.giftLookup(e164),
    onSuccess: (r) => {
      setRecipient(r);
      setError(null);
    },
    onError: (e) => {
      setRecipient(null);
      setError(toApiError(e).message);
    },
  });
  const send = useMutation({
    mutationFn: () => walletApi.gift(e164, amount),
    onSuccess: (m) => {
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      setSent(
        m ??
          `${naira(amount)} ride credit sent to ${recipient?.name ?? 'them'}. It shows in their wallet activity now.`,
      );
    },
    onError: (e) => setError(toApiError(e).message),
  });

  if (sent) {
    return (
      <Screen
        testID="send-credit"
        topBar={{ leading: 'close', onLeadingPress: () => navigation.goBack() }}
        footer={<Button title="Back to wallet" onPress={() => navigation.goBack()} />}
      >
        <View style={shared.centered}>
          <ResultIcon icon="checkmark" tone="blue" />
          <Text style={shared.heading}>Credit sent</Text>
          <Text style={shared.body}>{sent}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      testID="send-credit"
      topBar={{ title: 'Send credit' }}
      footer={
        <Button
          title={amount ? `Send ${naira(amount)}` : 'Send'}
          onPress={() => send.mutate()}
          disabled={!recipient || !amount || Number(amount) <= 0}
          loading={send.isPending}
        />
      }
    >
      <Text style={styles.body}>
        Send ride credit to another SR2Go wallet. Enter the phone number on their account.
      </Text>
      {error ? <Banner tone="error" message={error} onDismiss={() => setError(null)} /> : null}
      <TextField
        label="Their phone number"
        prefix="+234"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={(t) => {
          setPhone(t.replace(/\D/g, '').slice(0, 10));
          setRecipient(null);
        }}
        onBlur={() => phone.replace(/\D/g, '').length === 10 && lookup.mutate()}
        accessory={lookup.isPending ? <ActivityIndicator color={colors.brand} /> : undefined}
      />
      {recipient ? (
        <Card tone="tile">
          <ListRow
            title={recipient.name ?? 'SR2Go user'}
            subtitle={`${recipient.phoneMasked ?? ''} · Is this the right person?`}
            trailing={<Avatar name={recipient.name} size={36} verified={recipient.verified} />}
          />
        </Card>
      ) : null}
      <TextField
        label="Amount"
        prefix="₦"
        keyboardType="number-pad"
        value={amount}
        onChangeText={(t) => setAmount(t.replace(/\D/g, ''))}
        helper={
          wallet.data?.balance ? `Available: ${naira(wallet.data.balance)} ride credit` : undefined
        }
      />
      <Text style={shared.subtitle}>It stays ride credit for them, not cash.</Text>
    </Screen>
  );
}

/** W2 · Top up: card via Paystack, or the user's own bank-transfer account. */
export function TopUpScreen() {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<'card' | 'transfer' | null>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const account = useQuery({
    queryKey: ['topup-account'],
    queryFn: walletApi.topUpAccount,
    enabled: method === 'transfer',
    retry: false,
  });
  const card = useMutation({
    mutationFn: async () => {
      const r = await walletApi.topUpByCard(amount);
      if (!r.authorizationUrl) throw new Error('No payment page was returned');
      await WebBrowser.openBrowserAsync(r.authorizationUrl);
      return r;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      navigation.goBack();
    },
    onError: (e) => setError(toApiError(e).message),
  });

  const copy = (label: string, value: string | null) => {
    if (!value) return;
    void Clipboard.setStringAsync(value);
    setCopied(label);
  };

  return (
    <Screen
      testID="top-up"
      topBar={{ title: method === 'transfer' ? 'Bank transfer' : 'Top up' }}
      footer={
        method === 'card' ? (
          <Button
            title={amount ? `Pay ${naira(amount)}` : 'Pay'}
            onPress={() => card.mutate()}
            disabled={!amount || Number(amount) <= 0}
            loading={card.isPending}
          />
        ) : method === 'transfer' ? (
          <Button title="Done" onPress={() => navigation.goBack()} />
        ) : undefined
      }
    >
      {error ? <Banner tone="error" message={error} onDismiss={() => setError(null)} /> : null}
      {!method ? (
        <>
          <Text style={styles.body}>Add money to your SR2Go wallet to pay for rides.</Text>
          <ListRow
            icon="card-outline"
            title="Card"
            subtitle="Pay with your card through Paystack"
            onPress={() => setMethod('card')}
          />
          <ListRow
            icon="business-outline"
            title="Bank transfer"
            subtitle="Transfer from any bank app to your SR2Go account"
            onPress={() => setMethod('transfer')}
          />
        </>
      ) : method === 'card' ? (
        <>
          <TextField
            label="Amount"
            prefix="₦"
            keyboardType="number-pad"
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/\D/g, ''))}
            autoFocus
          />
          <View style={styles.row}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
            <Text style={styles.helperFlex}>
              We never store your card details. Payments are handled by Paystack.
            </Text>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.body}>
            Transfer any amount to this account from any bank app. Your wallet updates
            automatically, usually within a few minutes.
          </Text>
          {account.isPending ? <ActivityIndicator color={colors.brand} /> : null}
          {account.isError ? (
            <Banner tone="error" message={toApiError(account.error).message} />
          ) : null}
          {account.data
            ? (
                [
                  ['Account number', account.data.accountNumber],
                  ['Bank', account.data.bankName],
                  ['Account name', account.data.accountName],
                ] as [string, string | null][]
              ).map(([label, value]) => (
                <Pressable
                  key={label}
                  onPress={() => copy(label, value)}
                  style={styles.copyRow}
                  accessibilityRole="button"
                >
                  <View style={styles.flex}>
                    <Text style={shared.overline}>{label}</Text>
                    <Text style={styles.copyValue}>{value ?? '—'}</Text>
                  </View>
                  <Text style={styles.copyLink}>{copied === label ? 'Copied' : 'Copy'}</Text>
                </Pressable>
              ))
            : null}
          <InfoBanner>
            This account is yours alone and only accepts top-ups for your SR2Go wallet.
          </InfoBanner>
          <LinkText
            onPress={() => Linking.openURL('mailto:support@shareride2go.com?subject=Top-up')}
          >
            Problem with a transfer? Contact support
          </LinkText>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { ...typography.title, color: colors.text },
  balance: {
    backgroundColor: colors.navy,
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.xxs,
  },
  balanceLabel: { ...typography.overline, color: colors.textOnBrand, opacity: 0.85 },
  balanceAmount: {
    fontFamily: fonts.displayBold,
    fontSize: 32,
    lineHeight: 40,
    color: colors.textOnBrand,
  },
  balanceSub: { ...typography.body, color: colors.textOnBrand },
  twoUp: { flexDirection: 'row', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  helperFlex: { ...typography.secondary, color: colors.textMuted, flex: 1 },
  semi: { ...typography.bodySemibold, color: colors.text },
  body: { ...typography.body, color: colors.text },
  activity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  amount: { ...typography.bodySemibold, fontVariant: ['tabular-nums'] },
  codeTile: {
    backgroundColor: colors.tile,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.brand,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  code: {
    fontFamily: fonts.displayBold,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: 3,
    color: colors.text,
  },
  stats: { flexDirection: 'row', gap: spacing.xs },
  stat: {
    flex: 1,
    backgroundColor: colors.tile,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { ...typography.price, color: colors.text },
  tile: { backgroundColor: colors.tile, borderRadius: radius.md, padding: spacing.md },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  copyValue: { ...typography.bodySemibold, color: colors.text },
  copyLink: { ...typography.bodyMedium, color: colors.navy },
});
