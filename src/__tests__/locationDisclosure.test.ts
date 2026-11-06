/** Google Play's "prominent disclosure" for background location (6 Nov 2026). */
import { Alert } from 'react-native';

import { askBackgroundLocationConsent, DISCLOSURE_TEXT } from '../trip/locationDisclosure';

type Btn = { text: string; onPress?: () => void };

describe('the background location explanation', () => {
  it('says what is collected, that it runs when the app is closed, why, and when it stops', () => {
    expect(DISCLOSURE_TEXT).toContain("collects your car's location");
    expect(DISCLOSURE_TEXT).toContain('even when the app is closed or not in use');
    expect(DISCLOSURE_TEXT).toContain('follow the journey live');
    expect(DISCLOSURE_TEXT).toContain('stops automatically when the trip ends');
  });

  it.each([
    ['Continue', true],
    ['Not now', false],
  ])('%s answers %s', async (label, answer) => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      (buttons as Btn[]).find((b) => b.text === label)?.onPress?.();
    });
    await expect(askBackgroundLocationConsent()).resolves.toBe(answer);
    spy.mockRestore();
  });
});
