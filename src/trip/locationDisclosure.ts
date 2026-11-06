/**
 * The "prominent disclosure" Google Play requires before an app asks for
 * location "all the time" (Martin and Seun, 6 Nov 2026). It is shown in the app,
 * in plain words, BEFORE Android's own permission prompt, and says what is
 * collected, that it happens when the app is closed or not in use, why, and
 * when it stops. "Not now" skips the Android prompt: the trip screen then
 * shares the position only while it is open.
 */
import { Alert } from 'react-native';

export const DISCLOSURE_TITLE = 'Share your trip live';
export const DISCLOSURE_TEXT =
  "SR2Go collects your car's location during this trip, even when the app is closed or not in use " +
  'and the phone is locked, so your passengers and their families (and yours) can follow the ' +
  'journey live on the tracking link and get help quickly in an emergency. ' +
  'Sharing stops automatically when the trip ends, and your location is not used for anything else.\n\n' +
  'On the next screen, choose "Allow all the time".';

/** true when the driver taps Continue. */
export function askBackgroundLocationConsent(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      DISCLOSURE_TITLE,
      DISCLOSURE_TEXT,
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
