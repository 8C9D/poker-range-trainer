import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';

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
      return <ErrorFallback error={error} onRetry={this.reset} />;
    }
    return this.props.children;
  }
}

/**
 * Themed fallback UI. Split out as a function component so it can resolve the active
 * Coach palette with `useTheme()` — hooks can't run in the class boundary above.
 */
function ErrorFallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>Something went wrong</Text>
      <Text testID="error-message" style={styles.message}>
        {error.message || 'An unexpected error occurred.'}
      </Text>
      <Pressable
        testID="error-retry"
        accessibilityRole="button"
        style={styles.button}
        onPress={onRetry}
      >
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: 24,
      backgroundColor: theme.bg,
    },
    title: {
      color: theme.ink,
      fontSize: 20,
      fontWeight: '700',
    },
    message: {
      color: theme.ink2,
      fontSize: 15,
      textAlign: 'center',
    },
    button: {
      backgroundColor: theme.goldFill,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 8,
    },
    buttonText: {
      color: theme.onAccent,
      fontSize: 16,
      fontWeight: '600',
    },
  });
}
