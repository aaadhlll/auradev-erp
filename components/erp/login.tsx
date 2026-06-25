'use client'

import { useState, type FormEvent } from 'react'
import { useAuth } from '@/lib/auth-context'
import { ApiError } from '@/lib/api'
import { MercantileMark } from '@/components/brand/MercantileMark'
import { useTheme } from '@/lib/theme'

// ── Icons (inline SVG to avoid Lucide dep in login path) ──────────────────────
function IcoMail() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
}
function IcoLock() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
}
function IcoEye() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
}
function IcoEyeOff() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
}
function IcoMoon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
}
function IcoSun() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
}
function IcoArrowRight() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
}
function IcoLoader() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
}
function IcoScanLine() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" x2="7" y1="12" y2="12"/><line x1="17" x2="17" y1="12" y2="12"/><line x1="12" x2="12" y1="12" y2="12"/></svg>
}
function IcoBoxes() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"/><path d="m7 16.5-4.74-2.85"/><path d="m7 16.5 5-3"/><path d="M7 16.5v5.17"/><path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"/><path d="m17 16.5-5-3"/><path d="m17 16.5 4.74-2.85"/><path d="M17 16.5v5.17"/><path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"/><path d="M12 8 7.26 5.15"/><path d="m12 8 4.74-2.85"/><path d="M12 13.5V8"/></svg>
}
function IcoSparkles() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
}
function IcoBuilding() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>
}
function IcoInfo() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
}

// ── Google logo ────────────────────────────────────────────────────────────────
function GoogleLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18Z"/>
      <path fill="#FBBC05" d="M3.97 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.33Z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"/>
    </svg>
  )
}

// ── Checkbox ──────────────────────────────────────────────────────────────────
function Checkbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={'ckbox' + (checked ? ' on' : '')}
      onClick={e => { e.stopPropagation(); onChange(!checked) }}
      aria-checked={checked}
      role="checkbox"
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5"/>
      </svg>
    </button>
  )
}

// ── Password input ─────────────────────────────────────────────────────────────
function PasswordInput({
  value, onChange, error, placeholder, onEnter,
}: {
  value: string; onChange: (v: string) => void; error?: string; placeholder?: string; onEnter?: () => void
}) {
  const [show, setShow] = useState(false)
  return (
    <div className={'input' + (error ? ' error' : '')}>
      <IcoLock />
      <input
        type={show ? 'text' : 'password'}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && onEnter) onEnter() }}
        autoComplete="current-password"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        style={{ border: 0, background: 'transparent', cursor: 'pointer', display: 'flex', padding: 0, color: 'var(--fg-subtle)' }}
      >
        {show ? <IcoEyeOff /> : <IcoEye />}
      </button>
    </div>
  )
}

// ── Main LoginScreen ──────────────────────────────────────────────────────────
export function LoginScreen() {
  const { login } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [remember, setRemember] = useState(true)
  const [errors, setErrors] = useState<{ email?: string; pwd?: string }>({})
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)

  function validate() {
    const e: { email?: string; pwd?: string } = {}
    if (!email.trim()) e.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email address'
    if (!pwd) e.pwd = 'Password is required'
    else if (pwd.length < 6) e.pwd = 'Must be at least 6 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit() {
    setApiError('')
    if (!validate()) return
    setLoading(true)
    try {
      await login(email, pwd)
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    submit()
  }

  return (
    <div className="auth">
      {/* ── Brand panel ── */}
      <div className="auth-brand">
        <div className="auth-logo">
          <div className="mark">
            <MercantileMark height={22} />
          </div>
          <div>
            <div className="nm font-brand">Mercantile</div>
          </div>
        </div>

        <div className="auth-hero">
          <h1 className="font-brand">Run your store,&nbsp;end&#8209;to&#8209;end.</h1>
          <p>Billing, inventory, purchases and insights — one fast, AI&#8209;native workspace built for modern Indian retail.</p>
          <div className="auth-points">
            <div className="auth-point">
              <span className="pic"><IcoScanLine /></span>
              Lightning&#8209;fast billing with barcode &amp; UPI
            </div>
            <div className="auth-point">
              <span className="pic"><IcoBoxes /></span>
              Live inventory &amp; low&#8209;stock alerts
            </div>
            <div className="auth-point">
              <span className="pic"><IcoSparkles /></span>
              Tyga surfaces what needs your attention today
            </div>
          </div>
        </div>

        <div className="auth-foot">
          <span>© 2026 AuraDev</span>
          <span className="stat">
            <span className="live-dot" />
            All systems operational
          </span>
        </div>
      </div>

      {/* ── Form panel ── */}
      <div className="auth-main">
        <div className="auth-topbar">
          <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <IcoSun /> : <IcoMoon />}
          </button>
        </div>

        <div className="auth-card">
          <div className="auth-head">
            <h2>Welcome back</h2>
            <p>Sign in to Nenjankod Supermarket&apos;s workspace.</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {apiError && (
              <div style={{ background: 'var(--danger-soft)', color: 'var(--danger-fg)', borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 13 }}>
                {apiError}
              </div>
            )}

            <div className="field">
              <label>Work email</label>
              <div className={'input' + (errors.email ? ' error' : '')}>
                <IcoMail />
                <input
                  type="email"
                  value={email}
                  placeholder="you@store.in"
                  autoComplete="username"
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submit() }}
                  autoFocus
                />
              </div>
              {errors.email && <span className="err">{errors.email}</span>}
            </div>

            <div className="field">
              <label>Password</label>
              <PasswordInput value={pwd} onChange={setPwd} error={errors.pwd} placeholder="Enter your password" onEnter={submit} />
              {errors.pwd && <span className="err">{errors.pwd}</span>}
            </div>

            <div className="auth-row">
              <label className="remember" onClick={() => setRemember(r => !r)}>
                <Checkbox checked={remember} onChange={setRemember} />
                Keep me signed in
              </label>
              <span className="auth-link">Forgot password?</span>
            </div>

            <button type="submit" className="btn primary block lg" disabled={loading} style={{ height: 44, justifyContent: 'center' }}>
              {loading
                ? <><IcoLoader />Signing in…</>
                : <>Sign in<IcoArrowRight /></>}
            </button>

            <div className="auth-or">or continue with</div>

            <div className="sso-row">
              <button type="button" className="btn outline" style={{ height: 42, justifyContent: 'center' }}>
                <GoogleLogo />Google
              </button>
              <button type="button" className="btn outline" style={{ height: 42, justifyContent: 'center' }}>
                <IcoBuilding />SSO
              </button>
            </div>
          </form>

          <div className="auth-hint">
            <IcoInfo />
            <span><b>Credentials:</b> use <b>admin@nenjankod.in</b> with your set password.</span>
          </div>

          <div className="auth-switch">
            New to Mercantile? <span className="auth-link">Request access</span>
          </div>
        </div>

        <div className="auth-legal">
          By signing in you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.
        </div>
      </div>
    </div>
  )
}
