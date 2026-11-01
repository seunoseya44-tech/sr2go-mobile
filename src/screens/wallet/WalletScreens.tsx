import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';

import { walletApi, type GiftRecipient, type WalletActivity } from '../../api/account';
import { canSendRefundToCard, cashEntryId, walletMoneyApi } from '../../api/walletMoney';
import { toApiError } from '../../api/errors';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { Avatar, Card, Checkbox, InfoBanner, LinkText, ListRow } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { colors, fonts, radius, spacing, typography } from '../../theme';
import { naira, shortDate } from '../../utils/format';
import { ResultIcon, shared } from '../booking/shared';
import { appConfig } from '../../config/appConfig';

type Nav = NativeStackNavigationProp<AppStackParamList>;

/**
 * Screen 44 · Wallet (1 Nov: wallet money built). Two kinds of money, shown apart:
 *  - Your money (top-ups, refunds, earnings kept in the wallet): never expires,
 *    pays for seats, can be withdrawn to your own bank.
 *  - Ride credit (referrals, gifts): for rides only, never cash, expires.
 */
export function WalletScreen() {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: walletApi.wallet });
  const activity = useQuery({
    queryKey: ['wallet-activity'],
    queryFn: walletApi.activity,
    retry: false,
  });
  const [toCard, setToCard] = useState<WalletActivity | null>(null);
  const [openedAt] = useState(() => Date.now());
  const [note, setNote] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const sendToCard = useMutation({
    mutationFn: (entryId: string) => walletMoneyApi.refundToCard(entryId),
    onSuccess: (m) => {
      setToCard(null);
      setNote({ tone: 'success', text: m ?? 'Sent back to your card.' });
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['wallet-activity'] });
    },
    onError: (e) => {
      setToCard(null);
      setNote({ tone: 'error', text: toApiError(e).message });
    },
  });
  const w = wallet.data;
  const cfg = appConfig();
  const money = Number(w?.walletMoney ?? 0);
  // GET /api/wallet/activity has both kinds; an older server only has the ride-credit list.
  const items = activity.data ?? w?.activity ?? [];
  const refundCanGoToCard = (a: WalletActivity) =>
    canSendRefundToCard(a.type, a.id, a.date, openedAt, cfg.refundToCardDays);

  return (
    <Screen topBar={null} testID="wallet-screen">
      <Text style={styles.title}>Wallet</Text>
      {note ? (
        <Banner tone={note.tone} message={note.text} onDismiss={() => setNote(null)} />
      ) : null}

      <View style={styles.balance} testID="wallet-money">
        <Text style={styles.balanceLabel}>YOUR MONEY</Text>
        <Text style={styles.balanceAmount}>{wallet.isPending ? '…' : naira(money)}</Text>
        <Text style={styles.balanceSub}>
          {w?.walletMoneyNote ?? 'Never expires. Pay for seats or withdraw to your bank.'}
        </Text>
      </View>
      <View style={styles.twoUp}>
        {cfg.walletTopUpEnabled ? (
          <Button
            title="Top up"
            variant="secondary"
            icon="add-circle-outline"
            onPress={() => navigation.navigate('TopUp')}
            style={styles.flex}
            testID="top-up-button"
          />
        ) : null}
        {money > 0 ? (
          <Button
            title="Withdraw"
            variant="secondary"
            icon="arrow-up-circle-outline"
            onPress={() => navigation.navigate('Withdraw')}
            style={styles.flex}
            testID="withdraw-button"
          />
        ) : null}
      </View>

      <Card tone="tile" testID="ride-credit">
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={shared.overline}>Ride credit</Text>
            <Text style={styles.creditAmount}>
              {wallet.isPending ? '…' : naira(w?.balance ?? 0)}
            </Text>
          </View>
          <Button
            title="Send credit"
            variant="secondary"
            icon="paper-plane-outline"
            onPress={() => navigation.navigate('SendCredit')}
          />
        </View>
        <Text style={styles.helper}>
          {w?.expiryNote ??
            "Ride credit is for rides only. It isn't cash, can't be withdrawn and expires 12 months after you earn it."}
        </Text>
      </Card>

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
      {!activity.isPending && items.length === 0 ? (
        <Text style={shared.subtitle}>No activity yet.</Text>
      ) : null}
      {items.map((a) => {
        const negative =
          (a.amount ?? '').startsWith('-') ||
          (!a.money && /used|expired|sent|debit/i.test(`${a.type} ${a.description}`));
        return (
          <View key={a.id} style={styles.activityBlock}>
            <View style={styles.activity}>
              <View style={styles.flex}>
                <Text style={styles.body}>{a.description}</Text>
                <Text style={shared.subtitle}>
                  {[a.date ? shortDate(a.date) : null, kindLabel(a)].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Text style={[styles.amount, { color: negative ? colors.text : colors.navy }]}>
                {negative ? '−' : ''}
                {naira((a.amount ?? '').replace('-', ''))}
              </Text>
            </View>
            {refundCanGoToCard(a) && toCard?.id !== a.id ? (
              <LinkText onPress={() => setToCard(a)}>Send back to my card instead</LinkText>
            ) : null}
            {toCard?.id === a.id ? (
              <View style={styles.confirm}>
                <Text style={styles.body}>
                  Send {naira((a.amount ?? '').replace('-', ''))} back to the card you paid with?
                  Your bank usually shows it within 3 to 10 working days. It leaves your wallet now.
                </Text>
                <View style={styles.stack}>
                  <Button
                    title="Send to card"
                    onPress={() => sendToCard.mutate(cashEntryId(a.id)!)}
                    loading={sendToCard.isPending}
                  />
                  <Button
                    title="Keep in wallet"
                    variant="secondary"
                    onPress={() => setToCard(null)}
                  />
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
    </Screen>
  );
}

function kindLabel(a: WalletActivity): string | null {
  if (a.money === 'wallet') return 'Your money';
  if (a.money === 'credit') return 'Ride credit';
  return null;
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
    mutationFn: () => walletApi.gift(recipient!.id ?? '', amount),
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
          disabled={!recipient?.id || !amount || Number(amount) <= 0}
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
        prefix={appConfig().currencySymbol}
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

/**
 * W2 · Top up: card via Paystack, or the user's own bank-transfer account numbers.
 * Account numbers are opened in his name only after he agrees (release 114).
 * The card amount limits come from the server (release 118); Paystack's fee
 * is added on its page (card) or taken from the transfer (bank), release 115.
 */
export function TopUpScreen() {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const cfg = appConfig();
  const [method, setMethod] = useState<'card' | 'transfer' | null>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [result, setResult] = useState<{ credited: boolean; amount: string } | null>(null);
  const account = useQuery({
    queryKey: ['topup-account'],
    queryFn: walletApi.topUpAccounts,
    enabled: method === 'transfer',
    retry: false,
  });
  const open = useMutation({
    mutationFn: walletMoneyApi.openTopUpAccounts,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['topup-account'] }),
    onError: (e) => setError(toApiError(e).message),
  });
  const refreshWallet = () => {
    void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    void queryClient.invalidateQueries({ queryKey: ['wallet-activity'] });
  };
  const card = useMutation({
    mutationFn: async () => {
      const r = await walletApi.topUpByCard(amount);
      if (!r.authorizationUrl || !r.reference) throw new Error('No payment page was returned');
      await WebBrowser.openBrowserAsync(r.authorizationUrl, { showTitle: true });
      // The page closed: ask the server (the webhook may already have credited it).
      try {
        return await walletMoneyApi.verifyTopUp(r.reference);
      } catch {
        return { credited: false, status: 'unknown', balance: null };
      }
    },
    onSuccess: (v) => {
      refreshWallet();
      setResult({ credited: v.credited, amount });
    },
    onError: (e) => setError(toApiError(e).message),
  });

  const n = Number(amount);
  const amountOk = !!amount && n >= cfg.walletTopUpMin && n <= cfg.walletTopUpMax;
  const copy = (label: string, value: string | null) => {
    if (!value) return;
    void Clipboard.setStringAsync(value);
    setCopied(label);
  };
  const support = (
    <LinkText onPress={() => Linking.openURL(`mailto:${appConfig().supportEmail}?subject=Top-up`)}>
      Problem with a top-up? Contact support
    </LinkText>
  );

  if (result) {
    return (
      <Screen
        testID="top-up"
        topBar={{ leading: 'close', onLeadingPress: () => navigation.goBack() }}
        footer={<Button title="Back to wallet" onPress={() => navigation.goBack()} />}
      >
        <View style={shared.centered}>
          <ResultIcon icon={result.credited ? 'checkmark' : 'time-outline'} tone="blue" />
          <Text style={shared.heading}>
            {result.credited ? `${naira(result.amount)} added` : 'Checking your payment'}
          </Text>
          <Text style={shared.body}>
            {result.credited
              ? 'The money is in your wallet. Use it for seats or withdraw it to your bank.'
              : 'If you paid, your wallet updates within a few minutes. If you closed the page without paying, nothing was taken.'}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      testID="top-up"
      topBar={{ title: method === 'transfer' ? 'Bank transfer' : 'Top up' }}
      footer={
        method === 'card' ? (
          <Button
            title={amount ? `Pay ${naira(amount)}` : 'Pay'}
            onPress={() => {
              setError(null);
              card.mutate();
            }}
            disabled={!amountOk}
            loading={card.isPending}
            loadingTitle="Opening Paystack…"
          />
        ) : method === 'transfer' && account.data?.status === 'not_created' ? (
          <Button
            title="Get my account numbers"
            onPress={() => {
              setError(null);
              open.mutate();
            }}
            disabled={!agreed}
            loading={open.isPending}
          />
        ) : method === 'transfer' ? (
          <Button title="Done" onPress={() => navigation.goBack()} />
        ) : undefined
      }
    >
      {error ? <Banner tone="error" message={error} onDismiss={() => setError(null)} /> : null}
      {!method ? (
        <>
          <Text style={styles.body}>
            Add your own money to your SR2Go wallet. It never expires: use it for seats, or withdraw
            it to your bank.
          </Text>
          <ListRow
            icon="card-outline"
            title="Card"
            subtitle="Pay with your card through Paystack"
            onPress={() => setMethod('card')}
          />
          <ListRow
            icon="business-outline"
            title="Bank transfer"
            subtitle="Transfer from any bank app to your own SR2Go account number"
            onPress={() => setMethod('transfer')}
          />
        </>
      ) : method === 'card' ? (
        <>
          <TextField
            label="Amount"
            prefix={cfg.currencySymbol}
            keyboardType="number-pad"
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/\D/g, ''))}
            helper={`Between ${naira(cfg.walletTopUpMin)} and ${naira(cfg.walletTopUpMax)}`}
            error={
              amount && !amountOk
                ? `Top up between ${naira(cfg.walletTopUpMin)} and ${naira(cfg.walletTopUpMax)}`
                : undefined
            }
            autoFocus
          />
          <InfoBanner>
            Paystack&apos;s card fee is added on the payment page. Your wallet gets the full amount
            you enter. Money from a card can pay for seats at once; it can be withdrawn to a bank
            after {cfg.cardHoldDays} days.
          </InfoBanner>
          <View style={styles.row}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
            <Text style={styles.helperFlex}>
              We never store your card details. Payments are handled by Paystack.
            </Text>
          </View>
          {support}
        </>
      ) : (
        <>
          {account.isPending ? <ActivityIndicator color={colors.brand} /> : null}
          {account.isError ? (
            <Banner tone="error" message={toApiError(account.error).message} />
          ) : null}
          {account.data?.status === 'not_created' ? (
            <>
              <Text style={shared.heading}>Your own account numbers</Text>
              <Text style={styles.body}>
                To give you account numbers for top-ups, SR2Go asks Paystack to open them in your
                name, using the name, email and phone on your SR2Go account. Money sent to them goes
                only into your SR2Go wallet.
              </Text>
              <Checkbox checked={agreed} onChange={setAgreed}>
                I agree that SR2Go opens top-up account numbers in my name with Paystack.
              </Checkbox>
            </>
          ) : null}
          {account.data?.status === 'creating' ? (
            <Text style={shared.subtitle}>
              Your account numbers are being opened. Check back in a few minutes.
            </Text>
          ) : null}
          {account.data?.status === 'not_available' ? (
            <Text style={shared.subtitle}>
              Bank-transfer top-up is not available for your account yet. You can top up by card.
            </Text>
          ) : null}
          {account.data?.status === 'ready' ? (
            <Text style={styles.body}>
              Transfer any amount to one of these accounts from any bank app. Your wallet updates
              automatically, usually within a few minutes.
            </Text>
          ) : null}
          {account.data?.accounts.map((acc, i) => (
            <View key={`${acc.accountNumber ?? i}`} style={styles.tile}>
              {(
                [
                  ['Bank', acc.bankName],
                  ['Account number', acc.accountNumber],
                  ['Account name', acc.accountName],
                ] as [string, string | null][]
              ).map(([label, value]) => (
                <Pressable
                  key={label}
                  onPress={() => copy(`${label}-${i}`, value)}
                  style={styles.copyRow}
                  accessibilityRole="button"
                >
                  <View style={styles.flex}>
                    <Text style={shared.overline}>{label}</Text>
                    <Text style={styles.copyValue}>{value ?? '—'}</Text>
                  </View>
                  <Text style={styles.copyLink}>
                    {copied === `${label}-${i}` ? 'Copied' : 'Copy'}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))}
          {account.data && account.data.status !== 'not_created' ? (
            <InfoBanner>
              {account.data.note ??
                "These accounts are yours alone and only accept top-ups for your SR2Go wallet. Paystack's transfer fee is taken from the money you send."}
            </InfoBanner>
          ) : null}
          {support}
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
  creditAmount: { ...typography.price, color: colors.text },
  helper: { ...typography.secondary, color: colors.textMuted, marginTop: spacing.xs },
  activityBlock: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.xs,
    gap: spacing.xs,
  },
  confirm: {
    backgroundColor: colors.tile,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  twoUp: { flexDirection: 'row', gap: spacing.sm },
  stack: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  helperFlex: { ...typography.secondary, color: colors.textMuted, flex: 1 },
  semi: { ...typography.bodySemibold, color: colors.text },
  body: { ...typography.body, color: colors.text },
  activity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
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
