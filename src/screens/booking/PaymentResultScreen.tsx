import { ActivityIndicator, Linking, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { env } from '../../config/env';
import type { AppStackParamList } from '../../navigation/types';
import { colors } from '../../theme';
import { naira } from '../../utils/format';
import { ResultIcon, shared } from './shared';

type Nav = NativeStackNavigationProp<AppStackParamList>;

/** Screen 14 · Payment result: success, failed, confirming, too late, amount mismatch, refunded. */
export function PaymentResultScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'PaymentResult'>>();
  const goHome = () => navigation.navigate('Main', { screen: 'Home' });
  const toBooking = () => navigation.replace('Payment', { bookingId: params.bookingId });
  const msg = params.message ?? null;

  if (params.status === 'pending') {
    return (
      <Screen testID="payment-result" topBar={null}>
        <View style={shared.centered}>
          <ActivityIndicator color={colors.brand} size="large" />
          <Text style={shared.heading}>Confirming your payment…</Text>
          <Text style={shared.body}>Please don&apos;t close the app.</Text>
        </View>
      </Screen>
    );
  }

  const content = {
    paid: {
      icon: <ResultIcon icon="checkmark" tone="blue" />,
      heading: 'Payment received',
      body: `${params.youPaid ? `${naira(params.youPaid)} paid. ` : ''}Your seat is confirmed.`,
      footer: (
        <Button
          title="View my booking"
          onPress={() => navigation.replace('BookingConfirmation', { bookingId: params.bookingId })}
        />
      ),
    },
    failed: {
      icon: <ResultIcon icon="alert" />,
      heading: "Payment didn't go through",
      body: msg ?? 'Your card or bank did not confirm the payment.',
      footer: (
        <>
          <Button title="Try again" onPress={toBooking} />
          <Button title="Back to booking" variant="secondary" onPress={toBooking} />
        </>
      ),
    },
    refund_due: {
      icon: <ResultIcon icon="time-outline" />,
      heading: 'Your payment arrived after the booking closed',
      body: `It will be refunded in full.${msg ? ` ${msg}` : ''}`,
      footer: <Button title="Find another ride" onPress={goHome} />,
    },
    underpaid: {
      icon: <ResultIcon icon="alert" />,
      heading: "We couldn't confirm this payment",
      body: msg ?? '',
      footer: (
        <Button
          title="Contact support"
          onPress={() =>
            Linking.openURL(
              `mailto:support@shareride2go.com?subject=Payment ${params.reference ?? ''}`,
            )
          }
        />
      ),
    },
    refunded: {
      icon: <ResultIcon icon="alert" />,
      heading: 'This payment was refunded',
      body: msg ?? '',
      footer: <Button title="Back to booking" onPress={toBooking} />,
    },
  }[params.status];

  return (
    <Screen testID="payment-result" topBar={null} footer={content.footer}>
      <View style={shared.centered}>
        {content.icon}
        <Text style={shared.heading}>{content.heading}</Text>
        {content.body ? <Text style={shared.body}>{content.body}</Text> : null}
        {params.status === 'paid' && params.reference ? (
          <Text style={shared.small}>Reference: {params.reference}</Text>
        ) : null}
        {params.status === 'underpaid' ? (
          <Text style={shared.small}>{env.websiteUrl.replace(/^https?:\/\//, '')}</Text>
        ) : null}
      </View>
    </Screen>
  );
}
