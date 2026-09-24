import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiError } from '../api/errors';
import { LoginScreen } from '../screens/LoginScreen';

const mockSignIn = jest.fn();
const mockClearNotice = jest.fn();

jest.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ signIn: mockSignIn, notice: null, clearNotice: mockClearNotice }),
}));

jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: () => ({ isInternetReachable: true }),
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
});

describe('LoginScreen', () => {
  it('shows validation errors and does not call the API when empty', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByTestId('login-button'));

    expect(await screen.findByText('Enter your email address')).toBeTruthy();
    expect(screen.getByText('Enter your password')).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('rejects a malformed email', async () => {
    await renderScreen();
    await fillForm('not-an-email', 'secret');

    expect(await screen.findByText('Enter a valid email address')).toBeTruthy();
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

  it('shows a friendly message for wrong credentials', async () => {
    mockSignIn.mockRejectedValue(new ApiError('unauthorized', 'Invalid credentials', 401));
    await renderScreen();
    await fillForm('rider@sr2go.com', 'wrong');

    expect(await screen.findByText('Incorrect email or password. Please try again.')).toBeTruthy();
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
});
