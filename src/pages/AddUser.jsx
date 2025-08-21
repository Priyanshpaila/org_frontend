import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import api from '../lib/api.js'
import { useAuthStore } from '../store/authStore.js'
import { useNavigate } from 'react-router-dom'

export default function AddUser() {
  const isAdmin = useAuthStore(s => s.isAdmin())
  const nav = useNavigate()
  useEffect(() => { if (!isAdmin) nav('/') }, [isAdmin])

  const [meta, setMeta] = useState({ departments: [], divisions: [], designations: [] })
  const [managerQ, setManagerQ] = useState('')
  const [managerResults, setManagerResults] = useState([])
  const [form, setForm] = useState({
    name: '', empId: '', email: '', password: '',
    department: '', designation: '', division: '',
    dateOfJoining: '', status: 'active', reportingTo: []
  })
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    Promise.all([api.get('/meta/departments'), api.get('/meta/divisions'), api.get('/meta/designations')])
      .then(([d, v, g]) => setMeta({ departments: d.data, divisions: v.data, designations: g.data }))
  }, [])

  const searchManagers = async () => {
    const { data } = await api.get('/users', { params: { q: managerQ, limit: 10 } })
    setManagerResults(data.items || [])
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setMsg(null)
    try {
      await api.post('/users', form)
      setMsg('User created')
      setForm({ name: '', empId: '', email: '', password: '', department: '', designation: '', division: '', dateOfJoining: '', status: 'active', reportingTo: [] })
    } catch (e) { setMsg(e.response?.data?.error || 'Failed to create') }
  }

  return (
    <div className="min-h-full bg-gray-50">
      <Navbar />
      <div className="page">
        <div className="mb-4 text-xl font-semibold">Add User</div>
        {msg && <div className="mb-3 rounded-xl bg-amber-50 p-2 text-sm text-amber-800">{msg}</div>}
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Full Name"><input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required /></Field>
          <Field label="Email"><input className="input" type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} /></Field>
          <Field label="Password"><input className="input" type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} /></Field>
          <Field label="Employee ID"><input className="input" value={form.empId} onChange={e => setForm(f => ({...f, empId: e.target.value}))} /></Field>
          <Field label="Department"><select className="select" value={form.department} onChange={e => setForm(f => ({...f, department: e.target.value}))}><option value="">-</option>{meta.departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}</select></Field>
          <Field label="Designation"><select className="select" value={form.designation} onChange={e => setForm(f => ({...f, designation: e.target.value}))}><option value="">-</option>{meta.designations.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}</select></Field>
          <Field label="Division"><select className="select" value={form.division} onChange={e => setForm(f => ({...f, division: e.target.value}))}><option value="">-</option>{meta.divisions.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}</select></Field>
          <Field label="Date of Joining"><input className="input" type="date" value={form.dateOfJoining} onChange={e => setForm(f => ({...f, dateOfJoining: e.target.value}))} /></Field>
          <Field label="Status"><select className="select" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}><option>active</option><option>inactive</option><option>terminated</option><option>on_leave</option></select></Field>
          <div className="md:col-span-2 card p-4">
            <div className="mb-2 font-medium">Reporting To (multi)</div>
            <div className="flex items-center gap-2">
              <input className="input" placeholder="Search managers..." value={managerQ} onChange={e => setManagerQ(e.target.value)} />
              <button className="btn btn-ghost" type="button" onClick={searchManagers}>Search</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {managerResults.map(u => (
                <button type="button" key={u._id} className="badge border-gray-300"
                  onClick={() => setForm(f => ({...f, reportingTo: Array.from(new Set([...(f.reportingTo||[]), u._id]))}))}>
                  + {u.name}
                </button>
              ))}
            </div>
            <div className="mt-2 text-sm text-gray-600">Selected: {(form.reportingTo||[]).length} manager(s)</div>
          </div>
          <div className="md:col-span-2"><button className="btn btn-primary" type="submit">Create</button></div>
        </form>
      </div>
    </div>
  )
}
function Field({ label, children }) { return (<div className="card p-3"><div className="mb-1 label">{label}</div>{children}</div>) }
