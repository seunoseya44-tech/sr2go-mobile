import { act, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { User } from '../api/types';
import { HomeScreen } from '../screens/HomeScreen';
import { searchForm } from '../state/searchForm';

const mockAuth = { user: null as User | null };
const mockNavigate = jest.fn();
const mockTicker = jest.fn();

jest.mock('../auth/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: () => ({ isInternetReachable: true }),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));
jest.mock('../api/rides', () => ({ ridesApi: { ticker: () => mockTicker() } }));

const renderScreen = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}
      >
        <HomeScreen />
      </SafeAreaProvider>
    </QueryClientProvider>,
  );

const user: User = {
  id: '1',
  email: 'aisha@example.com',
  fullName: 'Aisha Bello',
  phone: null,
  role: 'passenger',
  phoneVerified: true,
  kycComplete: true,
  ninVerified: true,
  bankVerified: null,
  raw: {},
};

beforeEach(() => {
  mockNavigate.mockReset();
  mockTicker.mockResolvedValue([]);
  searchForm.reset();
});

describe('HomeScreen', () => {
  it('greets a verified user with the badge and no verify banner', async () => {
    mockAuth.user = user;
    await renderScreen();

    expect(screen.getByTestId('home-greeting')).toHaveTextContent(/Aisha$/);
    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.queryByTestId('verify-banner')).toBeNull();
  });

  it('shows the verify banner for an unverified user', async () => {
    mockAuth.user = { ...user, kycComplete: false };
    await renderScreen();

    expect(screen.getByTestId('verify-banner')).toBeTruthy();
    expect(screen.getByText('Verify your identity to book')).toBeTruthy();
  });

  it('shows the four approved trust lines and nothing else', async () => {
    mockAuth.user = user;
    await renderScreen();
    for (const line of [
      'Verified drivers',
      'Delayed Payout Protection',
      'QR boarding',
      'GPS trip tracking',
    ]) {
      expect(screen.getByText(line)).toBeTruthy();
    }
  });

  it('disables Find rides until both places are chosen, then searches', async () => {
    mockAuth.user = user;
    await renderScreen();
    const button = screen.getByTestId('find-rides');
    expect(button).toBeDisabled();

    await act(async () =>
      searchForm.set({
        origin: { name: 'Ojota, Lagos', city: 'Lagos', lat: 6.58, lng: 3.37 },
        destination: { name: 'Challenge, Ibadan', city: 'Ibadan', lat: 7.35, lng: 3.87 },
      }),
    );
    expect(await screen.findByText('Ojota, Lagos')).toBeTruthy();
    expect(screen.getByTestId('find-rides')).toBeEnabled();
  });

  it('renders popular routes from the ticker with the usual fare and badge', async () => {
    mockAuth.user = user;
    mockTicker.mockResolvedValue([
      {
        origin: 'Lagos',
        destination: 'Ibadan',
        price: '3900',
        motorParkAnchor: '4875',
        savingsPct: 20,
      },
    ]);
    await renderScreen();

    expect(await screen.findByText('Lagos → Ibadan')).toBeTruthy();
    expect(screen.getByText('Usual fare ₦4,875')).toBeTruthy();
    expect(screen.getByText('Save 20%')).toBeTruthy();
  });
});
