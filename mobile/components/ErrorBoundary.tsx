import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Root error boundary. Catches render-time errors anywhere below it and shows a
 * themed, recoverable fallback instead of unmounting the whole tree to a blank
 * screen. "Try again" clears the error and re-renders the children, which recovers
 * the app when the failure was transient. Presentation-only — the reused @core has
 * no React, so this lives in mobile/.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Record the failure (with its component stack) for debugging. No crash-reporting
    // backend is wired up; this is the hook where one would attach later.
    console.error('Unhandled render error:', error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        <View style={styles.screen}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text testID="error-message" style={styles.message}>
            {error.message || 'An unexpected error occurred.'}
          </Text>
          <Pressable
            testID="error-retry"
            accessibilityRole="button"
            style={styles.button}
            onPress={this.reset}
          >
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
    backgroundColor: colors.background,
  },
  title: {
    color: colors.textStrong,
    fontSize: 20,
    fontWeight: '700',
  },
  message: {
    color: colors.text,
    fontSize: 15,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '600',
  },
});
