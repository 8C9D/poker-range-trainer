import { useId, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { ApiClientError, changePassword, deleteAccount, signOutEverywhere } from '@/lib/api-client'

function messageFor(error: unknown, fallback: string): string {
  return error instanceof ApiClientError ? error.message : fallback
}

/** The message the API attached to one request field, when it named one. */
function fieldMessage(error: unknown, field: string): string | undefined {
  if (!(error instanceof ApiClientError)) return undefined
  return error.problem?.issues?.find((issue) => issue.path[0] === field)?.message
}

function PasswordCard() {
  const currentId = useId()
  const nextId = useId()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [saving, setSaving] = useState(false)
  const [currentError, setCurrentError] = useState<string>()
  const [nextError, setNextError] = useState<string>()
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setSaving(true)
    setCurrentError(undefined)
    setNextError(undefined)
    setError(undefined)
    setNotice(undefined)
    try {
      const response = await changePassword({ currentPassword: current, newPassword: next })
      const { otherSessionsRevoked: others } = response.data
      setCurrent('')
      setNext('')
      setNotice(
        others === 0
          ? 'Password changed.'
          : `Password changed. ${others} other ${others === 1 ? 'session was' : 'sessions were'} signed out.`,
      )
    } catch (caught) {
      const onCurrent = fieldMessage(caught, 'currentPassword')
      const onNext = fieldMessage(caught, 'newPassword')
      setCurrentError(onCurrent)
      setNextError(onNext)
      if (onCurrent === undefined && onNext === undefined) {
        setError(messageFor(caught, 'We could not change your password. Try again.'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="account-card" aria-labelledby="account-password">
      <h2 id="account-password">Password</h2>
      <p className="account-note">Changing it signs out every other device.</p>
      <form className="account-form" onSubmit={(event) => void save(event)}>
        <div className="field">
          <label htmlFor={currentId}>Current password</label>
          <input
            id={currentId}
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={current}
            aria-invalid={currentError ? true : undefined}
            aria-describedby={currentError ? `${currentId}-error` : undefined}
            onChange={(event) => setCurrent(event.target.value)}
          />
          {currentError ? (
            <p className="field-error" id={`${currentId}-error`} role="alert">
              {currentError}
            </p>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor={nextId}>New password</label>
          <input
            id={nextId}
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={next}
            aria-invalid={nextError ? true : undefined}
            aria-describedby={[`${nextId}-hint`, nextError ? `${nextId}-error` : '']
              .filter(Boolean)
              .join(' ')}
            onChange={(event) => setNext(event.target.value)}
          />
          <p className="field-hint" id={`${nextId}-hint`}>
            Use 12–128 characters, including a letter and number.
          </p>
          {nextError ? (
            <p className="field-error" id={`${nextId}-error`} role="alert">
              {nextError}
            </p>
          ) : null}
        </div>
        <div className="account-buttons">
          <button className="button button-primary" type="submit" disabled={saving}>
            {saving ? 'Changing…' : 'Change password'}
          </button>
        </div>
      </form>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="success-notice" role="status">
          {notice}
        </p>
      ) : null}
    </section>
  )
}

function SignOutEverywhereCard() {
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()

  async function run(): Promise<void> {
    setPending(true)
    setError(undefined)
    try {
      await signOutEverywhere()
      navigate('/login', { replace: true })
    } catch (caught) {
      setError(messageFor(caught, 'We could not sign you out. Try again.'))
      setPending(false)
    }
  }

  return (
    <section className="account-card" aria-labelledby="account-sessions">
      <h2 id="account-sessions">Sign out everywhere</h2>
      <p className="account-note">
        Ends every session on every device, this one included. Use it if you left yourself signed
        in somewhere.
      </p>
      <div className="account-buttons">
        <button className="button" type="button" disabled={pending} onClick={() => void run()}>
          {pending ? 'Signing out…' : 'Sign out everywhere'}
        </button>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}

function DeleteAccountCard() {
  const navigate = useNavigate()
  const passwordId = useId()
  const [password, setPassword] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [pending, setPending] = useState(false)
  const [passwordError, setPasswordError] = useState<string>()
  const [error, setError] = useState<string>()

  async function run(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setPending(true)
    setPasswordError(undefined)
    setError(undefined)
    try {
      await deleteAccount({ password, confirm: true })
      navigate('/', { replace: true })
    } catch (caught) {
      const onPassword = fieldMessage(caught, 'password')
      setPasswordError(onPassword)
      if (onPassword === undefined) {
        setError(messageFor(caught, 'We could not delete your account. Try again.'))
      }
      setPending(false)
    }
  }

  return (
    <section className="account-card" aria-labelledby="account-delete">
      <h2 id="account-delete">Delete account</h2>
      <p className="account-note">
        Permanently deletes your account, ranges, practice history and imported backups. This
        cannot be undone. Export a backup first if you might want your ranges again.
      </p>
      <form className="account-form" onSubmit={(event) => void run(event)}>
        <div className="field">
          <label htmlFor={passwordId}>Your password</label>
          <input
            id={passwordId}
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={password}
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? `${passwordId}-error` : undefined}
            onChange={(event) => setPassword(event.target.value)}
          />
          {passwordError ? (
            <p className="field-error" id={`${passwordId}-error`} role="alert">
              {passwordError}
            </p>
          ) : null}
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={acknowledged}
            disabled={pending}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          I understand this permanently deletes my account
        </label>
        <div className="account-buttons">
          <button
            className="button danger-button"
            type="submit"
            disabled={!acknowledged || password === '' || pending}
          >
            {pending ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      </form>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}

/** The account itself: its password, its sessions, and its deletion. */
export function AccountSecurity() {
  return (
    <>
      <PasswordCard />
      <SignOutEverywhereCard />
      <DeleteAccountCard />
    </>
  )
}
