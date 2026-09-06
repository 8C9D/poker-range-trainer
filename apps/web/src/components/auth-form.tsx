import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import { ApiClientError, getCurrentUser, login, register } from '@/lib/api-client'

type AuthMode = 'login' | 'register'

interface AuthFormProps {
  mode: AuthMode
}

function fieldErrors(error: ApiClientError): Record<string, string> {
  if (error.kind !== 'problem') return {}
  return Object.fromEntries(
    (error.problem?.issues ?? [])
      .filter((issue) => typeof issue.path[0] === 'string')
      .map((issue) => [issue.path[0] as string, issue.message]),
  )
}

export function AuthForm({ mode }: AuthFormProps) {
  const navigate = useNavigate()
  const emailId = useId()
  const passwordId = useId()
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [pending, setPending] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [sessionNotice, setSessionNotice] = useState<string>()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string>()

  useEffect(() => {
    let current = true
    void getCurrentUser()
      .then((response) => {
        if (current && response.data.authenticated) navigate('/app', { replace: true })
      })
      .catch(() => {
        if (current)
          setSessionNotice('We could not check for an existing session. You can still sign in.')
      })
      .finally(() => {
        if (current) setCheckingSession(false)
      })
    return () => {
      current = false
    }
  }, [navigate])

  async function submit(formData: FormData): Promise<void> {
    setPending(true)
    setErrors({})
    setGeneralError(undefined)
    const input = {
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
    }
    try {
      if (mode === 'login') await login(input)
      else await register(input)
      navigate('/app', { replace: true })
    } catch (error) {
      if (error instanceof ApiClientError) {
        const fields = fieldErrors(error)
        setErrors(fields)
        setGeneralError(Object.keys(fields).length === 0 ? error.message : undefined)
      } else {
        setGeneralError('Something went wrong. Please try again.')
      }
    } finally {
      setPending(false)
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    void submit(new FormData(event.currentTarget))
  }

  const isLogin = mode === 'login'
  const title = isLogin ? 'Welcome back' : 'Start training with intent'
  const action = isLogin ? 'Sign in' : 'Create account'

  return (
    <main className="auth-page">
      <Link className="brand" to="/">
        <span aria-hidden="true">♠</span> Rangecraft
      </Link>
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">{isLogin ? 'Your practice room' : 'A sharper preflop routine'}</p>
        <h1 id="auth-title">{title}</h1>
        <p className="auth-intro">
          {isLogin
            ? 'Sign in to return to your saved training library.'
            : 'Create an account to keep your practice library and progress together.'}
        </p>
        {checkingSession ? (
          <p className="quiet" aria-live="polite">
            Checking your session…
          </p>
        ) : null}
        {sessionNotice ? (
          <p className="quiet" role="status">
            {sessionNotice}
          </p>
        ) : null}
        {generalError ? (
          <p className="form-error" role="alert">
            {generalError}
          </p>
        ) : null}
        <form className="auth-form" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor={emailId}>Email address</label>
            <input
              id={emailId}
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? `${emailId}-error` : undefined}
            />
            {errors.email ? (
              <p className="field-error" id={`${emailId}-error`} role="alert">
                {errors.email}
              </p>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor={passwordId}>Password</label>
            <div className="password-control">
              <input
                id={passwordId}
                name="password"
                type={passwordVisible ? 'text' : 'password'}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
                minLength={12}
                maxLength={128}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={[
                  `${passwordId}-hint`,
                  errors.password ? `${passwordId}-error` : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
              <button
                className="text-button password-toggle"
                type="button"
                aria-pressed={passwordVisible}
                onClick={() => setPasswordVisible((visible) => !visible)}
              >
                {passwordVisible ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="field-hint" id={`${passwordId}-hint`}>
              Use 12–128 characters, including a letter and number.
            </p>
            {errors.password ? (
              <p className="field-error" id={`${passwordId}-error`} role="alert">
                {errors.password}
              </p>
            ) : null}
          </div>
          <button
            className="button button-primary"
            type="submit"
            disabled={pending || checkingSession}
          >
            {pending ? `${action}…` : action}
          </button>
        </form>
        <p className="auth-switch">
          {isLogin ? 'New to Rangecraft?' : 'Already have an account?'}{' '}
          <Link to={isLogin ? '/register' : '/login'}>
            {isLogin ? 'Create an account' : 'Sign in'}
          </Link>
        </p>
      </section>
    </main>
  )
}
