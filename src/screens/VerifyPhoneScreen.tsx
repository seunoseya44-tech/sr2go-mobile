import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { authApi } from '../api/auth';
import { toApiError } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { Heading, LinkText, Overline, RoadLine, Subtext } from '../components/ui';
import { colors, radius, spacing, typography } from '../theme';
import { maskPhone } from '../utils/format';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

/**
 * Screen 03: Verify phone (step 2 of 2). One hidden input drives six boxes so
 * the phone's own number keyboard and SMS autofill work. Wrong-code text comes
 * from the backend (it states the tries left).
 */
export function VerifyPhoneScreen() {
  const { user, markPhoneVerified, signOut } = useAuth();
  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const submit = async (value = code) => {
    if (value.length !== CODE_LENGTH || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await authApi.verifyPhone(value);
      await markPhoneVerified();
    } catch (e) {
      setError(toApiError(e).message);
      setCode('');
    } finally {
      setSubmitting(false);
    }
  };

  const onChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    setError(null);
    if (digits.length === CODE_LENGTH) void submit(digits);
  };

  const resend = async () => {
    try {
      await authApi.resendOtp();
      setNotice('We sent a new code.');
      setResendIn(RESEND_SECONDS);
    } catch (e) {
      setError(toApiError(e).message);
    }
  };

  const mm = String(Math.floor(resendIn / 60));
  const ss = String(resendIn % 60).padStart(2, '0');

  return (
    <Screen
      testID="verify-phone-screen"
      topBar={{ leading: 'back', onLeadingPress: () => void signOut() }}
      footer={
        <Button
          testID="verify-button"
          title="Verify"
          onPress={() => void submit()}
          loading={submitting}
          disabled={code.length !== CODE_LENGTH}
        />
      }
    >
      <View style={styles.stepRow}>
        <Overline>Step 2 of 2</Overline>
        <View style={styles.flex} />
        <RoadLine length={48} />
        <RoadLine length={48} />
      </View>

      <View style={styles.header}>
        <Heading>Enter the code</Heading>
        <Subtext>
          We sent a 6-digit code to {maskPhone(user?.phone)}. It expires in 10 minutes.
        </Subtext>
      </View>

      <Pressable
        onPress={() => inputRef.current?.focus()}
        style={styles.boxes}
        accessibilityLabel="Verification code"
      >
        {Array.from({ length: CODE_LENGTH }).map((_, i) => {
          const char = code[i] ?? '';
          const active = i === code.length;
          return (
            <View
              key={i}
              style={[styles.box, active && styles.boxActive, !!error && styles.boxError]}
              testID={`code-box-${i}`}
            >
              <Text style={styles.boxText}>{char}</Text>
            </View>
          );
        })}
        <TextInput
          ref={inputRef}
          testID="code-input"
          value={code}
          onChangeText={onChange}
          keyboardType="number-pad"
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          maxLength={CODE_LENGTH}
          autoFocus
          style={styles.hiddenInput}
          caretHidden
          accessibilityLabel="Verification code"
        />
      </Pressable>

      {error ? (
        <Banner tone="error" message={error} onDismiss={() => setError(null)} testID="otp-error" />
      ) : null}
      {notice ? <Banner tone="info" message={notice} onDismiss={() => setNotice(null)} /> : null}

      <View style={styles.row}>
        {resendIn > 0 ? (
          <Text style={styles.muted} testID="resend-timer">
            Resend code in {mm}:{ss}
          </Text>
        ) : (
          <LinkText onPress={() => void resend()} testID="resend-link">
            Resend code
          </LinkText>
        )}
        <LinkText onPress={() => void signOut()} testID="change-number">
          Wrong number? Change it
        </LinkText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  header: { gap: spacing.xs },
  boxes: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  box: {
    flex: 1,
    height: 56,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  boxActive: { borderBottomColor: colors.brand },
  boxError: { borderBottomColor: colors.danger },
  boxText: { ...typography.price, color: colors.text },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  muted: { ...typography.secondary, color: colors.textMuted },
});
