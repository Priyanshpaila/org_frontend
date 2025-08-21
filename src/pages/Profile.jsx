import { useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import api from '../lib/api.js'
import { useAuthStore } from '../store/authStore.js'

export default function Profile() {
  const user = useAuthStore(s => s.user)
  const setUser = useAuthStore(s => s.setUser)
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '' })
  const [msg, setMsg] = useState(null)

  const onSubmit = async (e) => {
    e.preventDefault()
    setMsg(null)
    try {
      const { data } = await api.patch('/users/me/profile', form)
      setUser(data)
      setMsg('Profile updated')
    } catch (e) { setMsg(e.response?.data?.error || 'Failed to update') }
  }

  return (
    <div className="min-h-full bg-gray-50">
      <Navbar />
      <div className="page">
        <div className="mb-4 text-xl font-semibold">My Profile</div>
        {msg && <div className="mb-3 rounded-xl bg-amber-50 p-2 text-sm text-amber-800">{msg}</div>}
        <form onSubmit={onSubmit} className="grid max-w-xl grid-cols-1 gap-4">
          <Field label="Full name"><input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} /></Field>
          <Field label="Email"><input className="input" type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} /></Field>
          <Field label="Phone"><input className="input" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} /></Field>
          <button className="btn btn-primary w-fit" type="submit">Save</button>
        </form>
      </div>
    </div>
  )
}
function Field({ label, children }) { return (<div className="card p-3"><div className="mb-1 label">{label}</div>{children}</div>) }
