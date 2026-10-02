import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { authApi } from '../api/auth';
import { toApiError } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import {
  Checkbox,
  Heading,
  LinkText,
  Overline,
  RoadLine,
  Segmented,
  Subtext,
} from '../components/ui';
import { env } from '../config/env';
import type { AuthStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';
import {
  PASSWORD_RULE,
  signUpSchema,
  type SignUpFormValues,
  type SignUpValues,
} from './signUpSchema';

const FIELD_MAP: Record<string, keyof SignUpFormValues> = {
  full_name: 'fullName',
  email: 'email',
  phone: 'phone',
  password: 'password',
  role: 'role',
};

/** Screen 02: Create account (step 1 of 2). Step 2 is phone verification. */
export function CreateAccountScreen() {
  const { register } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [showReferral, setShowReferral] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormValues, unknown, SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      role: 'passenger',
      referralCode: '',
      agreed: false,
    },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const referralCode = values.referralCode?.trim() || undefined;
    try {
      if (referralCode) {
        const ok = await authApi.validateReferral(referralCode).catch(() => true);
        if (!ok) {
          setError('referralCode', {
            message: 'This code is not valid. Check it or leave it empty.',
          });
          return;
        }
      }
      await register({
        fullName: values.fullName,
        email: values.email,
        phone: `+234${values.phone}`,
        password: values.password,
        role: values.role,
        referralCode,
      });
      // The root navigator now shows the Verify phone step.
    } catch (error) {
      const apiError = toApiError(error);
      let mapped = false;
      for (const [apiField, formField] of Object.entries(FIELD_MAP)) {
        const message = apiError.fieldErrors[apiField];
        if (message) {
          setError(formField, { message });
          mapped = true;
        }
      }
      if (!mapped) setFormError(apiError.message);
    }
  });

  return (
    <Screen
      testID="create-account-screen"
      footer={
        <>
          <Button
            testID="continue-button"
            title="Continue"
            onPress={onSubmit}
            loading={isSubmitting}
            loadingTitle="Creating your account…"
          />
          <View style={styles.centerRow}>
            <Text style={styles.muted}>Already have an account? </Text>
            <LinkText onPress={() => navigation.navigate('Login')} testID="go-login">
              Log in
            </LinkText>
          </View>
          <View style={styles.centerRow}>
            <Ionicons name="lock-closed-outline" size={12} color={colors.textMuted} />
            <Text style={styles.security}> Bank-level security</Text>
          </View>
        </>
      }
    >
      <View style={styles.stepRow}>
        <Overline>Step 1 of 2</Overline>
        <View style={styles.flex} />
        <RoadLine length={48} />
        <RoadLine length={48} color={colors.border} />
      </View>

      <View style={styles.header}>
        <Heading>Create your account</Heading>
        <Subtext>We&apos;ll text a code to confirm your phone.</Subtext>
      </View>

      {formError ? (
        <Banner
          tone="error"
          message={formError}
          onDismiss={() => setFormError(null)}
          testID="signup-error"
        />
      ) : null}

      <View style={styles.form}>
        <View style={styles.roleBlock}>
          <Text style={styles.roleLabel}>I want to</Text>
          <Controller
            control={control}
            name="role"
            render={({ field: { onChange, value } }) => (
              <Segmented
                testID="role"
                value={value ?? 'passenger'}
                onChange={onChange}
                options={[
                  { value: 'passenger', label: 'Travel' },
                  { value: 'driver', label: 'Drive' },
                ]}
              />
            )}
          />
        </View>

        <Controller
          control={control}
          name="fullName"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              testID="fullname-input"
              label="Full name"
              placeholder="Aisha Bello"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.fullName?.message}
              editable={!isSubmitting}
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          )}
        />
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              ref={emailRef}
              testID="email-input"
              label="Email"
              placeholder="aisha@example.com"
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
              onSubmitEditing={() => phoneRef.current?.focus()}
            />
          )}
        />
        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              ref={phoneRef}
              testID="phone-input"
              label="Phone number"
              prefix="+234"
              placeholder="803 123 4521"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.phone?.message}
              editable={!isSubmitting}
              keyboardType="phone-pad"
              autoComplete="tel-national"
              textContentType="telephoneNumber"
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
              placeholder="Choose a password"
              helper={PASSWORD_RULE}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.password?.message}
              editable={!isSubmitting}
              secureTextEntry={!passwordVisible}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="done"
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

        <Controller
          control={control}
          name="agreed"
          render={({ field: { onChange, value } }) => (
            <Checkbox
              checked={!!value}
              onChange={onChange}
              testID="agree-checkbox"
              error={errors.agreed?.message}
            >
              I am 18 or older and agree to the{' '}
              <Text style={styles.link} onPress={() => Linking.openURL(`${env.websiteUrl}/terms`)}>
                Terms
              </Text>{' '}
              and{' '}
              <Text
                style={styles.link}
                onPress={() => Linking.openURL(`${env.websiteUrl}/privacy`)}
              >
                Privacy Policy
              </Text>
            </Checkbox>
          )}
        />

        {showReferral ? (
          <Controller
            control={control}
            name="referralCode"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                testID="referral-input"
                label="Referral code"
                placeholder="e.g. SR2GO-AMB-ADA-1234"
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.referralCode?.message}
                editable={!isSubmitting}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            )}
          />
        ) : (
          <LinkText onPress={() => setShowReferral(true)} testID="show-referral">
            Have a referral code? Add it
          </LinkText>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  header: { gap: spacing.xs },
  form: { gap: spacing.md },
  roleBlock: { gap: spacing.xs },
  roleLabel: { ...typography.label, color: colors.textMuted },
  centerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  muted: { ...typography.secondary, color: colors.textMuted },
  security: { ...typography.label, color: colors.textMuted },
  link: { color: colors.navy, fontFamily: typography.bodyMedium.fontFamily },
});
