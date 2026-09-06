import { Link } from 'react-router'

export function HomePage() {
  return (
    <main>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <Link className="brand" to="/">
          <span aria-hidden="true">♠</span> Rangecraft
        </Link>
        <nav aria-label="Account">
          <Link className="text-button" to="/login">
            Sign in
          </Link>
          <Link className="button button-small" to="/register">
            Start training
          </Link>
        </nav>
      </header>
      <section className="hero" id="main-content">
        <div className="hero-copy">
          <p className="eyebrow">Preflop, practiced deliberately</p>
          <h1>Know your ranges before the pressure is on.</h1>
          <p className="hero-lede">
            Rangecraft turns your Texas Hold’em starting-hand ranges into a focused practice
            routine—so every seat, stack, and action becomes easier to recognize.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/register">
              Build your practice library
            </Link>
            <Link className="text-link" to="/login">
              I already have an account <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        <aside className="hero-card" aria-label="Training principle">
          <p className="card-number">01</p>
          <p className="eyebrow">Make a clear decision</p>
          <h2>One hand. One spot. A confident answer.</h2>
          <p>
            Keep preflop knowledge sharp with a library built around the situations you actually
            play.
          </p>
        </aside>
      </section>
      <section className="principles" aria-label="How Rangecraft works">
        <article>
          <span className="principle-index">01</span>
          <h2>Build your library</h2>
          <p>Organize personal preflop charts around positions, stacks, and actions.</p>
        </article>
        <article>
          <span className="principle-index">02</span>
          <h2>Practice with focus</h2>
          <p>Turn a range into small, repeatable decisions that stay with you.</p>
        </article>
        <article>
          <span className="principle-index">03</span>
          <h2>See what needs work</h2>
          <p>Use your progress to choose the next purposeful drill.</p>
        </article>
      </section>
    </main>
  )
}
