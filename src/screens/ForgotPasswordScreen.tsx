import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

import { authApi } from '../api/auth';
import { toApiError } from '../api/errors';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { Card, Heading, LinkText, Subtext } from '../components/ui';
import { colors, spacing, typography } from '../theme';
import { forgotSchema, type ForgotFormValues } from './signUpSchema';

/**
 * Screen 06: Forgot password. The request always succeeds on the backend, so
 * the success text is the same for every email and never reveals whether an
 * account exists.
 */
export function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null);
    try {
      await authApi.requestPasswordReset(email);
      setSent(true);
    } catch (e) {
      const err = toApiError(e);
      // Network problems are the only thing worth reporting; the server
      // answers 200 whether or not the email exists.
      if (err.kind === 'network' || err.kind === 'timeout') setFormError(err.message);
      else setSent(true);
    }
  });

  return (
    <Screen
      testID="forgot-password-screen"
      footer={
        sent ? (
          <Card tone="tile" testID="reset-sent">
            <View style={styles.sentHeader}>
              <Ionicons name="mail-outline" size={22} color={colors.navy} />
              <Text style={styles.sentTitle}>Check your email</Text>
            </View>
            <Text style={styles.sentBody}>
              If this email is registered, we&apos;ve sent a reset link. Open it to set a new
              password, then come back and log in.
            </Text>
          </Card>
        ) : (
          <Button
            testID="send-reset"
            title="Send reset link"
            onPress={onSubmit}
            loading={isSubmitting}
          />
        )
      }
    >
      <View style={styles.header}>
        <Heading>Reset your password</Heading>
        <Subtext>
          Enter the email you signed up with. We&apos;ll send you a link to set a new password.
        </Subtext>
        <LinkText onPress={() => navigation.goBack()} testID="back-to-login">
          Back to log in
        </LinkText>
      </View>

      {formError ? (
        <Banner tone="error" message={formError} onDismiss={() => setFormError(null)} />
      ) : null}

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            testID="email-input"
            label="Email"
            placeholder="you@example.com"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.email?.message}
            editable={!isSubmitting && !sent}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={onSubmit}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  sentHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sentTitle: { ...typography.heading, color: colors.text },
  sentBody: { ...typography.body, color: colors.textMuted },
});
