import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { User } from '../api/types';
import { HomeScreen } from '../screens/HomeScreen';
import { makeJwt, nowInSeconds } from './helpers';

const mockAuth = {
  user: null as User | null,
  tokens: {
    accessToken: makeJwt({ exp: nowInSeconds() + 45 * 60 }),
    refreshToken: 'r',
    tokenType: 'bearer',
  },
  signOut: jest.fn(),
  refreshProfile: jest.fn(),
};

jest.mock('../auth/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: () => ({ isInternetReachable: true }),
}));

const renderScreen = () =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <HomeScreen />
    </SafeAreaProvider>,
  );

describe('HomeScreen', () => {
  it('greets the user and shows profile and session details', async () => {
    mockAuth.user = {
      id: '1',
      email: 'seun@example.com',
      fullName: 'Seun Adeyemi',
      phone: null,
      role: 'passenger',
      isVerified: true,
      raw: {},
    };
    await renderScreen();

    expect(screen.getByTestId('home-greeting')).toHaveTextContent(/Seun$/);
    expect(screen.getByText('seun@example.com')).toBeTruthy();
    expect(screen.getByText('Passenger')).toBeTruthy();
    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.getByText('Not provided')).toBeTruthy(); // phone
    expect(screen.getByText('in 45 min')).toBeTruthy();
    expect(screen.getByText('Enabled')).toBeTruthy();
  });

  it('still renders when no profile is available', async () => {
    mockAuth.user = null;
    await renderScreen();

    expect(screen.getByTestId('home-greeting')).toHaveTextContent(/there$/);
    expect(screen.getByTestId('logout-button')).toBeTruthy();
  });
});
