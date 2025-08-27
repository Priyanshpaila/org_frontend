import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../lib/api.js'
import { useAuthStore } from '../store/authStore.js'

export default function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [empId, setEmpId] = useState('')             // 👈 REQUIRED
  const [password, setPassword] = useState('')       // exactly 8 chars
  const [confirm, setConfirm] = useState('')         // exactly 8 chars

  const [showPwd, setShowPwd] = useState(false)
  const [showCfm, setShowCfm] = useState(false)
  const [capsOn, setCapsOn] = useState(false)

  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(false)
  const [touched, setTouched] = useState({})

  const loginStore = useAuthStore(s => s.login)
  const nav = useNavigate()

  // ---------- validation ----------
  const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim())
  const nameOk  = (n) => String(n || '').trim().length >= 2
  const empOk   = (v) => String(v || '').trim().length > 0   // required; add stricter rules if you want

  const errors = useMemo(() => {
    const e = {}
    if (!nameOk(name)) e.name = 'Full name is required (min 2 characters)'
    if (!email.trim()) e.email = 'Email is required'
    else if (!emailOk(email)) e.email = 'Enter a valid email'
    if (!empOk(empId)) e.empId = 'Employee ID is required'
    if (!password) e.password = 'Password is required'
    else if (password.length !== 8) e.password = 'Password must be exactly 8 characters'
    if (!confirm) e.confirm = 'Confirm your password'
    else if (confirm !== password) e.confirm = 'Passwords do not match'
    return e
  }, [name, email, empId, password, confirm])

  const invalid = Object.keys(errors).length > 0

  // cap inputs to 8 chars (also enforced via maxLength attr)
  const onPwdChange = (v) => setPassword(v.slice(0, 8))
  const onCfmChange = (v) => setConfirm(v.slice(0, 8))

  // caps lock hint (for both password fields)
  useEffect(() => {
    const handler = (ev) => setCapsOn(Boolean(ev?.getModifierState && ev.getModifierState('CapsLock')))
    window.addEventListener('keydown', handler)
    window.addEventListener('keyup', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('keyup', handler)
    }
  }, [])

  // ---------- submit ----------
  const onSubmit = async (e) => {
    e.preventDefault()
    setTouched({ name: true, email: true, empId: true, password: true, confirm: true })
    setErr(null)
    if (invalid) return

    try {
      setLoading(true)

      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        empId: empId.trim(),            // 👈 always include (required)
        password
      }

      const { data } = await api.post('/auth/signup', payload)

      // auto-login (no refresh token in your app)
      loginStore({
        user: data.user,
        accessToken: data.accessToken,
      })
      nav('/')
    } catch (e) {
      if (e?.response?.data?.error) setErr(e.response.data.error)
      else if (e?.message?.includes('Network')) setErr('Unable to reach the server. Please check your connection and try again.')
      else setErr('Signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-b from-brand-50 to-white px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white/90 p-6 shadow-sm backdrop-blur"
      >
        {/* Brand */}
        <div className="mb-5 flex items-center justify-center">
          <img
            src="/logo.png"
            alt="YourCompany logo"
            className="h-50 w-50 rounded-xl object-contain"
            loading="eager"
            width={110}
            height={110}
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        </div>

        <div className="mb-2 text-center text-2xl font-semibold">Create your account</div>

        {err && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">
            {err}
          </div>
        )}

        {/* Name */}
        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">Full name</label>
          <input
            className="input w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched(t => ({ ...t, name: true }))}
            placeholder="Your name"
            required
          />
          {touched.name && errors.name && (
            <div className="mt-1 text-xs text-rose-600">{errors.name}</div>
          )}
        </div>

        {/* Email */}
        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
          <input
            className="input w-full"
            type="email"
            inputMode="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(t => ({ ...t, email: true }))}
            placeholder="you@company.com"
            required
          />
          {touched.email && errors.email && (
            <div className="mt-1 text-xs text-rose-600">{errors.email}</div>
          )}
        </div>

        {/* Employee ID (REQUIRED) */}
        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">Employee ID</label>
          <input
            className="input w-full"
            value={empId}
            onChange={(e) => setEmpId(e.target.value)}
            onBlur={() => setTouched(t => ({ ...t, empId: true }))}
            placeholder="e.g., EMP12345"
            required
          />
          {touched.empId && errors.empId && (
            <div className="mt-1 text-xs text-rose-600">{errors.empId}</div>
          )}
        </div>

        {/* Passwords */}
        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Password <span className="text-gray-400">(exactly 8 characters)</span>
          </label>
          <div className="relative">
            <input
              className="input w-full pr-24"
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={(e) => onPwdChange(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, password: true }))}
              autoComplete="new-password"
              minLength={8}
              maxLength={8}
              placeholder="••••••••"
              required
            />
            <div className="pointer-events-none absolute inset-y-0 right-12 flex items-center text-xs text-gray-500">
              {password.length}/8
            </div>
            <button
              type="button"
              className="absolute right-2 inset-y-0 my-auto rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
              onClick={() => setShowPwd(v => !v)}
              aria-label={showPwd ? 'Hide password' : 'Show password'}
            >
              {showPwd ? 'Hide' : 'Show'}
            </button>
          </div>
          {touched.password && errors.password && (
            <div className="mt-1 text-xs text-rose-600">{errors.password}</div>
          )}
        </div>

        <div className="mb-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">Confirm password</label>
          <div className="relative">
            <input
              className="input w-full pr-24"
              type={showCfm ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => onCfmChange(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, confirm: true }))}
              autoComplete="new-password"
              minLength={8}
              maxLength={8}
              placeholder="••••••••"
              required
            />
            <div className="pointer-events-none absolute inset-y-0 right-12 flex items-center text-xs text-gray-500">
              {confirm.length}/8
            </div>
            <button
              type="button"
              className="absolute right-2 inset-y-0 my-auto rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
              onClick={() => setShowCfm(v => !v)}
              aria-label={showCfm ? 'Hide password' : 'Show password'}
            >
              {showCfm ? 'Hide' : 'Show'}
            </button>
          </div>
          {touched.confirm && errors.confirm && (
            <div className="mt-1 text-xs text-rose-600">{errors.confirm}</div>
          )}
          {capsOn && (
            <div className="mt-1 text-xs text-amber-600">Caps Lock is ON</div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4">
          <button
            className="btn btn-primary w-full items-center flex justify-center"
            type="submit"
            disabled={loading || invalid}
            title={invalid ? 'Please fix the errors above' : 'Create account'}
          >
            {loading ? 'Creating…' : 'Sign up'}
          </button>
          <div className="mt-3 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-600 underline">
              Login
            </Link>
          </div>
        </div>
      </form>
    </div>
  )
}
