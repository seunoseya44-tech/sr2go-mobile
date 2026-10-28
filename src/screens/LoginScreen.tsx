import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { toApiError } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { Heading, LinkText, Subtext } from '../components/ui';
import { env } from '../config/env';
import type { AuthStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';
import { loginSchema, type LoginFormValues } from './loginSchema';

/**
 * Screen 05: Log in. Three states: default, wrong details (the backend
 * message, which states the tries left) and locked (backend message plus a
 * Reset password button). The app never writes its own attempt count.
 */
export function LoginScreen() {
  const { signIn, notice, clearNotice } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const passwordRef = useRef<TextInput>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: env.devTestCredentials,
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    clearNotice();
    try {
      await signIn(values);
      // Navigation happens automatically: the root navigator swaps to the
      // signed-in tree as soon as the auth state changes.
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === 'login_locked' || apiError.kind === 'rateLimited') {
        setLocked(true);
        setFormError(apiError.message);
        return;
      }
      if (apiError.kind === 'unauthorized') {
        // Show the backend's wording as given (it includes the tries left).
        setFormError(apiError.message);
        return;
      }
      let mappedToField = false;
      for (const field of ['email', 'password'] as const) {
        const message = apiError.fieldErrors[field];
        if (message) {
          setError(field, { message });
          mappedToField = true;
        }
      }
      if (!mappedToField) setFormError(apiError.message);
    }
  });

  const banner = formError ?? notice;

  return (
    <Screen
      testID="login-screen"
      footer={
        locked ? (
          <Button
            testID="reset-password-button"
            title="Reset password"
            onPress={() => navigation.navigate('ForgotPassword')}
          />
        ) : (
          <Button
            testID="login-button"
            title="Log in"
            onPress={onSubmit}
            loading={isSubmitting}
            loadingTitle="Logging you in…"
          />
        )
      }
    >
      <View style={styles.header}>
        <Heading>Welcome back</Heading>
        <Subtext>Log in to book or manage your trips.</Subtext>
        <View style={styles.inline}>
          <Text style={styles.muted}>New to SR2Go? </Text>
          <LinkText onPress={() => navigation.navigate('CreateAccount')} testID="go-create-account">
            Create account
          </LinkText>
        </View>
      </View>

      <View style={styles.form}>
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
              editable={!isSubmitting && !locked}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              ref={passwordRef}
              testID="password-input"
              label="Password"
              placeholder="Your password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.password?.message}
              editable={!isSubmitting && !locked}
              secureTextEntry={!passwordVisible}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
              accessory={
                <Pressable
                  testID="toggle-password"
                  onPress={() => setPasswordVisible((v) => !v)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                >
                  <Ionicons
                    name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={colors.textMuted}
                  />
                </Pressable>
              }
            />
          )}
        />

        <View style={styles.forgot}>
          <LinkText onPress={() => navigation.navigate('ForgotPassword')} testID="go-forgot">
            Forgot password?
          </LinkText>
        </View>

        {banner ? (
          <Banner
            testID="login-error"
            tone={formError ? 'error' : 'warning'}
            message={banner}
            onDismiss={() => {
              setFormError(null);
              clearNotice();
            }}
          />
        ) : null}
      </View>

      {locked ? <Subtext>Reset your password to unlock your account.</Subtext> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  inline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  muted: { ...typography.body, color: colors.textMuted },
  form: { gap: spacing.md },
  forgot: { alignItems: 'flex-end' },
});
