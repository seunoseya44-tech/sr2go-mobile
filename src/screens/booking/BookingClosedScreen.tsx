import { Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import type { AppStackParamList } from '../../navigation/types';
import { ResultIcon, shared } from './shared';

type Nav = NativeStackNavigationProp<AppStackParamList>;

/**
 * Booking closed (Martin, 7 Nov 2026): shown instead of a red error bar when the server answers `booking_closed`
 * (the ride has left, or it is too late for the driver to answer). The server's message is shown exactly as sent.
 */
export function BookingClosedScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'BookingClosed'>>();
  const goHome = () => navigation.navigate('Main', { screen: 'Home' });
  return (
    <Screen
      testID="booking-closed"
      topBar={null}
      footer={
        <>
          {params.search ? (
            <Button
              title="Find a later ride"
              testID="find-later-ride"
              onPress={() => navigation.replace('SearchResults', { params: params.search! })}
            />
          ) : null}
          <Button
            title="Back to home"
            variant={params.search ? 'secondary' : 'primary'}
            testID="booking-closed-home"
            onPress={goHome}
          />
        </>
      }
    >
      <View style={shared.centered}>
        <ResultIcon icon="time-outline" />
        <Text style={shared.heading}>Booking for this ride has closed</Text>
        {params.route ? <Text style={shared.small}>{params.route}</Text> : null}
        <Text style={shared.body} testID="booking-closed-message">
          {params.message || 'This ride is no longer taking bookings. Please choose a later ride.'}
        </Text>
      </View>
    </Screen>
  );
}
