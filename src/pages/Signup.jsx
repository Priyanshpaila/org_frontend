import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../lib/api.js'
import { useAuthStore } from '../store/authStore.js'

export default function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState(null)
  const loginStore = useAuthStore(s => s.login)
  const nav = useNavigate()

  const onSubmit = async (e) => {
    e.preventDefault()
    setErr(null)
    try {
      const { data } = await api.post('/auth/signup', { name, email, password })
      loginStore({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken })
      nav('/')
    } catch (e) {
      setErr(e.response?.data?.error || 'Signup failed')
    }
  }

  return (
    <div className="grid h-full place-items-center bg-gradient-to-b from-brand-50 to-white">
      <form onSubmit={onSubmit} className="card w-full max-w-md p-6">
        <div className="mb-4 text-center text-2xl font-semibold">Create your account</div>
        {err && <div className="mb-3 rounded-xl bg-red-50 p-2 text-sm text-red-700">{err}</div>}
        <div className="mb-3">
          <div className="label">Full name</div>
          <input className="input" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div className="mb-3">
          <div className="label">Email</div>
          <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="mb-4">
          <div className="label">Password</div>
          <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <button className="btn btn-primary w-full" type="submit">Sign up</button>
        <div className="mt-3 text-center text-sm">
          Already have an account? <Link to="/login" className="text-brand-600 underline">Login</Link>
        </div>
      </form>
    </div>
  )
}
