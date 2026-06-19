import './GettingStarted.css'

/**
 * First-run onboarding panel shown when the library is empty.
 *
 * Purely presentational: a short welcome plus a few concise steps that match
 * this app's actual controls (Save Range, Practice, the import controls). It is
 * rendered by `AppShell` only while there are no saved ranges, so it disappears
 * once the user saves or imports their first range.
 */
export function GettingStarted() {
  return (
    <section className="getting-started" aria-label="Getting started">
      <h2>Welcome to Poker Range Trainer</h2>
      <p>Build, save, and practice Texas Hold&rsquo;em preflop ranges. To get started:</p>
      <ol>
        <li>Click hands on the 13×13 grid to build a range.</li>
        <li>
          Enter a name and click <strong>Save Range</strong>.
        </li>
        <li>
          Find it in your library and click <strong>Practice</strong> to drill it.
        </li>
        <li>
          Or use <strong>Import range</strong>, <strong>Import CSV</strong>, or{' '}
          <strong>Import pack</strong>, or open a shared link.
        </li>
      </ol>
    </section>
  )
}
