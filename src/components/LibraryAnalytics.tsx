import type { LibraryAnalytics as LibraryAnalyticsData } from '../domain/libraryAnalytics'
import './LibraryAnalytics.css'

interface LibraryAnalyticsProps {
  analytics: LibraryAnalyticsData
}

/**
 * Compact library-wide practice summary (v6 analytics).
 *
 * Self-hides (renders `null`) until there is practice data, so the parent can
 * render it unconditionally. Purely presentational: every figure comes from
 * `summarizeLibraryAnalytics`.
 */
export function LibraryAnalytics({ analytics }: LibraryAnalyticsProps) {
  if (analytics.totalAttempts === 0) return null
  return (
    <section className="library-analytics" aria-label="Practice analytics">
      <h2>Your practice</h2>
      <dl className="library-analytics-figures">
        <div>
          <dt>Ranges practiced</dt>
          <dd>{analytics.rangesPracticed}</dd>
        </div>
        <div>
          <dt>Questions answered</dt>
          <dd>{analytics.totalAttempts}</dd>
        </div>
        <div>
          <dt>Overall accuracy</dt>
          <dd>{analytics.overallAccuracy.toFixed(0)}%</dd>
        </div>
      </dl>
    </section>
  )
}
