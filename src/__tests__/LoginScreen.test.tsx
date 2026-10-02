import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiError } from '../api/errors';
import { LoginScreen } from '../screens/LoginScreen';

const mockSignIn = jest.fn();
const mockClearNotice = jest.fn();
const mockNavigate = jest.fn();

jest.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ signIn: mockSignIn, notice: null, clearNotice: mockClearNotice }),
}));
jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: () => ({ isInternetReachable: true }),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <LoginScreen />
    </SafeAreaProvider>,
  );
}

async function fillForm(email: string, password: string) {
  await fireEvent.changeText(screen.getByTestId('email-input'), email);
  await fireEvent.changeText(screen.getByTestId('password-input'), password);
  await fireEvent.press(screen.getByTestId('login-button'));
}

beforeEach(() => {
  mockSignIn.mockReset();
  mockNavigate.mockReset();
});

describe('LoginScreen', () => {
  it('shows validation errors and does not call the API when empty', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByTestId('login-button'));

    expect(await screen.findByText('Enter your email address')).toBeTruthy();
    expect(screen.getByText('Enter your password')).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('submits trimmed credentials', async () => {
    mockSignIn.mockResolvedValue(undefined);
    await renderScreen();
    await fillForm('  rider@sr2go.com ', 'Secret@123');

    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith({ email: 'rider@sr2go.com', password: 'Secret@123' }),
    );
  });

  it('shows the backend message word for word on wrong details', async () => {
    const message =
      'Wrong email or password. You have 3 tries left before your account is locked for a while.';
    mockSignIn.mockRejectedValue(
      new ApiError(
        'unauthorized',
        message,
        401,
        {},
        { code: 'invalid_credentials', attemptsLeft: 3 },
      ),
    );
    await renderScreen();
    await fillForm('rider@sr2go.com', 'wrong');

    expect(await screen.findByText(message)).toBeTruthy();
  });

  it('switches to the locked state with a Reset password button', async () => {
    mockSignIn.mockRejectedValue(
      new ApiError(
        'rateLimited',
        'Too many attempts. Try again in 15 minutes.',
        429,
        {},
        {
          code: 'login_locked',
          retryAfterMinutes: 15,
        },
      ),
    );
    await renderScreen();
    await fillForm('rider@sr2go.com', 'wrong');

    expect(await screen.findByText('Too many attempts. Try again in 15 minutes.')).toBeTruthy();
    expect(screen.queryByTestId('login-button')).toBeNull();
    await fireEvent.press(screen.getByTestId('reset-password-button'));
    expect(mockNavigate).toHaveBeenCalledWith('ForgotPassword');
  });

  it('shows network errors', async () => {
    mockSignIn.mockRejectedValue(new ApiError('network', 'No internet connection.'));
    await renderScreen();
    await fillForm('rider@sr2go.com', 'pw');

    expect(await screen.findByText('No internet connection.')).toBeTruthy();
  });

  it('maps server-side field errors onto the inputs', async () => {
    mockSignIn.mockRejectedValue(
      new ApiError('validation', 'Invalid', 422, { email: 'Account is disabled' }),
    );
    await renderScreen();
    await fillForm('rider@sr2go.com', 'pw');

    expect(await screen.findByText('Account is disabled')).toBeTruthy();
  });

  it('toggles password visibility', async () => {
    await renderScreen();
    const input = screen.getByTestId('password-input');
    expect(input.props.secureTextEntry).toBe(true);

    await fireEvent.press(screen.getByTestId('toggle-password'));
    expect(screen.getByTestId('password-input').props.secureTextEntry).toBe(false);
  });

  it('links to Create account and Forgot password', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByTestId('go-create-account'));
    expect(mockNavigate).toHaveBeenCalledWith('CreateAccount');
    await fireEvent.press(screen.getByTestId('go-forgot'));
    expect(mockNavigate).toHaveBeenCalledWith('ForgotPassword');
  });
});
