import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, typography } from '../theme';
import { Button } from './Button';

interface State {
  hasError: boolean;
}

/**
 * Last line of defence: a render error shows a recovery screen instead of a
 * blank white app. This is where a crash reporter (Sentry, Crashlytics) would
 * be wired in `componentDidCatch`.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) console.error('Unhandled render error', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.container}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>An unexpected error occurred. Please try again.</Text>
        <Button title="Try again" onPress={() => this.setState({ hasError: false })} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
