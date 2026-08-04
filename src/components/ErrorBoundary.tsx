import { Component, type ErrorInfo, type ReactNode } from 'react'
import './ErrorBoundary.css'

interface ErrorBoundaryProps {
  children: ReactNode
  /**
   * What to show instead of the generic screen. Set where the failing subtree is
   * only part of the app and the rest is still usable, so the boundary can offer
   * a way back into it rather than replacing everything.
   */
  fallback?: (error: Error) => ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Error boundary. Catches render-time errors anywhere below it and shows a
 * recoverable, Coach-styled fallback instead of unmounting the whole tree to a
 * blank page. "Try again" clears the error and re-renders the children, which
 * recovers the app when the failure was transient. Mirrors the mobile boundary.
 *
 * Mounted at the root, and again around each lazily-loaded subtree with its own
 * `fallback` — see App.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Record the failure (with its component stack) for debugging. No crash-reporting
    // backend is wired up; this is the hook where one would attach later.
    console.error('Unhandled render error:', error, info.componentStack)
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (error) {
      if (this.props.fallback) return this.props.fallback(error)
      return (
        <main className="error-boundary">
          <div className="coach-card error-boundary-card" role="alert">
            <h1>Something went wrong</h1>
            <p className="error-boundary-message">
              {error.message || 'An unexpected error occurred.'}
            </p>
            <button type="button" className="coach-btn primary" onClick={this.reset}>
              Try again
            </button>
          </div>
        </main>
      )
    }
    return this.props.children
  }
}
