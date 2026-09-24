# SR2Go Mobile — Login Test Task

React Native (Expo) implementation of the ShareRide2Go technical test:

> Build a login screen that calls `POST /api/auth/login` with email and password, handles the JWT
> token response, and navigates to a basic home screen on success.

Base URL: `https://shareride2go.com`

> Screenshots: add `docs/login.png`, `docs/login-error.png` and `docs/home.png` from a real device
> and reference them here.

---

## Quick start

**Requirements:** Node 20+ and the **Expo Go** app on an Android or iOS phone (or an emulator).

```bash
git clone <this-repo-url>
cd sr2go-mobile
npm install
cp .env.example .env        # defaults already point at https://shareride2go.com
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS), then sign in with the test account
you were given.

| Script                | What it does                                  |
| --------------------- | --------------------------------------------- |
| `npm start`           | Start the Expo dev server                     |
| `npm run android/ios` | Open on an emulator / simulator               |
| `npm test`            | Run the Jest test suite                       |
| `npm run typecheck`   | TypeScript in strict mode                     |
| `npm run lint`        | ESLint (Expo config + Prettier compatibility) |
| `npm run verify`      | All of the above, as CI runs it               |

> **Web preview:** `npm run web` works too. The API only allows browser (CORS) requests from
> `https://shareride2go.com`, so in development the Expo dev server proxies `/api/*` to the real API
> (see [`metro.config.js`](metro.config.js)) and the web app calls it same-origin. Native apps aren't
> subject to CORS and always call the API directly. The proxy is dev-only.

### Installable build (no Expo Go needed)

```bash
npx eas-cli@latest build --profile preview --platform android   # produces a shareable .apk
```

---

## What's implemented

### The brief

- **Login screen** with email and password, calling `POST /api/auth/login`.
- **JWT handling:** the access token (and refresh token, if the server issues one) is parsed from the
  response and stored in the device keystore.
- **Navigation to Home** on success, using the React Navigation auth-flow pattern.

### Production details on top of the brief

| Area                     | Details                                                                                                                                                                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Secure storage**       | Tokens live in the iOS Keychain / Android Keystore via `expo-secure-store` (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, never synced). No AsyncStorage for credentials, and `android:allowBackup` is off.                                                                        |
| **Persistent session**   | Relaunching the app restores the session behind the native splash screen, so there's no flash of the login screen.                                                                                                                                                          |
| **Token refresh**        | Uses the backend's `POST /api/auth/refresh`: an expired token is refreshed on launch, and any `401` mid-session triggers **one** shared refresh followed by a retry of the original request. If the refresh token is rejected, the user is signed out with a clear message. |
| **Error handling**       | Every failure becomes a typed `ApiError`: wrong credentials, FastAPI `422` field errors mapped onto the matching input, network down, timeout, rate limiting, and 5xx. Raw server bodies are never shown to users.                                                          |
| **Validation**           | Zod schema with react-hook-form. The email is trimmed and checked for format. Passwords are deliberately _not_ rule-checked on login, so older accounts aren't locked out.                                                                                                  |
| **UX polish**            | Brand colours from shareride2go.com, Inter typography, keyboard-aware layout, "next"/"go" return keys, a show/hide password toggle, a loading state that disables double-submits, haptic feedback, an offline banner, and pull-to-refresh on Home.                          |
| **Accessibility**        | Labelled inputs and buttons, errors announced via live regions, hit slop on small touch targets.                                                                                                                                                                            |
| **Resilience**           | A root error boundary, and a failed `/me` call never blocks sign-in (it falls back to the login payload, then to JWT claims). The cached profile keeps Home usable offline.                                                                                                 |
| **Quality gates**        | Strict TypeScript, ESLint and Prettier, a Jest and Testing Library suite, and GitHub Actions CI.                                                                                                                                                                            |
| **Release-ready config** | Bundle IDs, adaptive icons, splash screen, EAS build profiles, and release bundles that strip dev-only values.                                                                                                                                                              |

---

## Architecture

```
App.tsx                      Providers, font loading, splash-screen gating
src/
├── api/
│   ├── client.ts            Axios instance: auth header, 401 → refresh → retry (single-flight)
│   ├── auth.ts              login() and me() endpoints
│   ├── parsers.ts           Tolerant token/user parsing (snake_case, camelCase, {data} envelopes)
│   ├── errors.ts            ApiError and FastAPI error normalisation
│   └── types.ts
├── auth/
│   ├── AuthContext.tsx      Auth state machine: restoring → signedOut ⇄ signedIn
│   ├── session.ts           In-memory and keystore token holder, plus a session-expired event
│   └── jwt.ts               Decode / expiry helpers
├── storage/secureStorage.ts Keystore wrapper (in-memory fallback on web)
├── navigation/              React Navigation native stack, typed routes
├── screens/                 LoginScreen, HomeScreen, loginSchema
├── components/              TextField, Button, Banner, BrandMark, OfflineNotice, ErrorBoundary
├── theme/                   Colour, spacing, radius and typography tokens
└── utils/format.ts
```

### Auth flow

```
launch ─► load tokens from keystore
            ├─ none ───────────────────────────► Login
            ├─ access token expired ─► refresh ─┬─ ok ─► Home
            │                                   └─ fail ► Login ("session expired")
            └─ valid ─► Home (cached profile) ─► refresh /me in background

Login ─► POST /api/auth/login ─► save tokens ─► GET /api/auth/me ─► Home
Any request ─► 401 ─► POST /api/auth/refresh (shared) ─► retry ─┬─ ok
                                                                └─ fail ► sign out
```

Screens are registered conditionally on auth state, so a signed-out user can't reach Home (not even
with the back gesture) and nothing calls `navigate('Home')` by hand.

### Decisions worth calling out

- **Expo (managed) over bare React Native CLI:** reviewers can run it instantly in Expo Go, and
  EAS covers signed store builds without local Xcode or Android Studio. Native folders are generated
  (Continuous Native Generation), so nothing native is hand-edited.
- **React Navigation over Expo Router:** the role asks for React Navigation experience specifically.
- **Tolerant response parsing:** the login response shape isn't documented publicly, so the parser
  accepts the common conventions (`access_token`, `token`, `accessToken`, `{ data: … }`). A harmless
  backend rename won't break sign-in, and a truly missing token fails loudly.
- **No credentials in the repo:** the test account is typed in by hand. For faster local testing,
  `EXPO_PUBLIC_DEV_TEST_EMAIL` / `EXPO_PUBLIC_DEV_TEST_PASSWORD` in `.env` prefill the form in
  **dev builds only**. The values sit behind `__DEV__`, so they're stripped from release bundles.

---

## Testing

```bash
npm test
```

| Suite                                                  | Covers                                                                                                                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client.test.ts`                                       | Bearer header, no token on `/login`, 401 → refresh → retry, **one** refresh for concurrent 401s, sign-out when refresh fails, opt-out requests                                        |
| `LoginScreen.test.tsx`                                 | Empty and invalid validation, trimmed submit, wrong-password message, network error, server field errors, password toggle                                                             |
| `errors.test.ts`                                       | FastAPI `detail` string and list, 5xx sanitising, network, timeout, 429                                                                                                               |
| `parsers.test.ts`                                      | Token and user shapes, envelopes, missing token                                                                                                                                       |
| `AuthContext.test.tsx`                                 | Sign-in persists tokens, `/me` fallback to JWT claims, failed login stays signed out, session restore, expired-token refresh on launch, forced sign-out, sign-out clears the keystore |
| `HomeScreen.test.tsx`                                  | Greeting, profile and session rows, rendering without a profile                                                                                                                       |
| `jwt.test.ts`, `loginSchema.test.ts`, `format.test.ts` | Expiry skew, validation rules, display helpers                                                                                                                                        |

### Manual test checklist (real device)

- [ ] Correct credentials → Home shows your profile
- [ ] Wrong password → "Incorrect email or password"
- [ ] Airplane mode → offline banner, and a friendly error on submit
- [ ] Kill and reopen the app → still signed in, no login flash
- [ ] Sign out → back to Login; the back gesture doesn't return to Home
- [ ] Pull to refresh on Home → profile re-fetched

---

## API endpoints used

| Method | Path                | Purpose                                |
| ------ | ------------------- | -------------------------------------- |
| `POST` | `/api/auth/login`   | `{ email, password }` → JWT            |
| `GET`  | `/api/auth/me`      | Current user profile (Bearer)          |
| `POST` | `/api/auth/refresh` | `{ refresh_token }` → new access token |
