import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toApiError } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import { Banner } from '../components/Banner';
import { BrandMark } from '../components/BrandMark';
import { Button } from '../components/Button';
import { OfflineNotice } from '../components/OfflineNotice';
import { TextField } from '../components/TextField';
import { env } from '../config/env';
import { colors, radius, shadow, spacing, typography } from '../theme';
import { loginSchema, type LoginFormValues } from './loginSchema';

const WEBSITE_URL = 'https://shareride2go.com';

export function LoginScreen() {
  const { signIn, notice, clearNotice } = useAuth();
  const insets = useSafeAreaInsets();
  const passwordRef = useRef<TextInput>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
      // signed-in stack as soon as the auth state changes.
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.kind === 'unauthorized') {
        setFormError('Incorrect email or password. Please try again.');
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
    <View style={styles.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={[colors.midnight, colors.navy]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, { paddingTop: insets.top + spacing.xxl }]}
          >
            <BrandMark />
            <Text style={styles.heroTitle}>Share the Ride.{'\n'}Reach Together.</Text>
            <View style={styles.pill}>
              <Ionicons name="shield-checkmark" size={14} color={colors.brand} />
              <Text style={styles.pillText}>Nigeria’s verified intercity carpooling</Text>
            </View>
          </LinearGradient>

          <OfflineNotice />

          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
            <View style={styles.header}>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>Sign in to book seats and manage your trips.</Text>
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

            <View style={styles.form}>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextField
                    testID="email-input"
                    label="Email address"
                    icon="mail-outline"
                    placeholder="you@example.com"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.email?.message}
                    editable={!isSubmitting}
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
                    icon="lock-closed-outline"
                    placeholder="Enter your password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.password?.message}
                    editable={!isSubmitting}
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

              <Pressable
                style={styles.forgot}
                onPress={() => Linking.openURL(WEBSITE_URL)}
                accessibilityRole="link"
                hitSlop={8}
              >
                <Text style={styles.link}>Forgot password?</Text>
              </Pressable>

              <Button
                testID="login-button"
                title="Sign in"
                onPress={onSubmit}
                loading={isSubmitting}
              />
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>New to SR2Go? </Text>
              <Pressable
                onPress={() => Linking.openURL(WEBSITE_URL)}
                accessibilityRole="link"
                hitSlop={8}
              >
                <Text style={styles.link}>Create an account</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    backgroundColor: colors.surface,
  },
  hero: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl + spacing.lg,
    gap: spacing.lg,
  },
  heroTitle: {
    ...typography.display,
    color: colors.textOnBrand,
  },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs + 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.pill,
    paddingVertical: spacing.xxs + 2,
    paddingHorizontal: spacing.sm,
  },
  pillText: {
    ...typography.caption,
    color: colors.textOnBrand,
  },
  sheet: {
    flex: 1,
    marginTop: -spacing.xl,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    gap: spacing.xl,
    ...shadow.card,
  },
  header: {
    gap: spacing.xxs,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
  form: {
    gap: spacing.lg,
  },
  forgot: {
    alignSelf: 'flex-end',
    marginTop: -spacing.xs,
  },
  link: {
    ...typography.label,
    color: colors.brand,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
  },
  footerText: {
    ...typography.label,
    color: colors.textMuted,
  },
});
