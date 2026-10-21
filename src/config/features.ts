/**
 * Feature switches for parts of the backend that go live after the app
 * (SR2Go answers, 21 Oct 2026). Flip to true when the release lands.
 */
export const FEATURES = {
  /** Wallet top-up: Mon 26 Oct release, if Paystack has switched the feature on. */
  topUp: false,
} as const;
