import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import api from '../lib/api.js'
import { useAuthStore } from '../store/authStore.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState(null)
  const loginStore = useAuthStore(s => s.login)
  const nav = useNavigate()
  const loc = useLocation()

  const onSubmit = async (e) => {
    e.preventDefault()
    setErr(null)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      loginStore({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken })
      nav(loc.state?.from?.pathname || '/')
    } catch (e) {
      setErr(e.response?.data?.error || 'Login failed')
    }
  }

  return (
    <div className="grid h-full place-items-center bg-gradient-to-b from-brand-50 to-white">
      <form onSubmit={onSubmit} className="card w-full max-w-md p-6">
        <div className="mb-4 text-center text-2xl font-semibold">Welcome back</div>
        {err && <div className="mb-3 rounded-xl bg-red-50 p-2 text-sm text-red-700">{err}</div>}
        <div className="mb-3">
          <div className="label">Email</div>
          <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="mb-4">
          <div className="label">Password</div>
          <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <button className="btn btn-primary w-full" type="submit">Login</button>
        <div className="mt-3 text-center text-sm">
          No account? <Link to="/signup" className="text-brand-600 underline">Sign up</Link>
        </div>
      </form>
    </div>
  )
}
