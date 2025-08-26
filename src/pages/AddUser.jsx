import { useEffect, useMemo, useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import api from '../lib/api.js'
import { useAuthStore } from '../store/authStore.js'
import { useNavigate } from 'react-router-dom'

const STATUS_OPTIONS = ['active', 'inactive', 'vacant', 'on_leave']
const MGR_MIN_CHARS = 2
const MGR_DEBOUNCE_MS = 400

export default function AddUser() {
  const isAdmin = useAuthStore(s => s.isAdmin())
  const nav = useNavigate()
  useEffect(() => { if (!isAdmin) nav('/') }, [isAdmin])

  // ---- meta (select options) ----
  const [meta, setMeta] = useState({ departments: [], divisions: [], designations: [] })
  const [loadingMeta, setLoadingMeta] = useState(true)

  // ---- manager search ----
  const [managerQ, setManagerQ] = useState('')
  const [managerResults, setManagerResults] = useState([])
  const [searchingMgrs, setSearchingMgrs] = useState(false)

  // Track selected managers as FULL objects for display, while form keeps only IDs
  const [selectedManagers, setSelectedManagers] = useState([]) // [{_id,name,empId,email}]

  // ---- form state ----
  const [form, setForm] = useState({
    name: '',
    empId: '',
    email: '',
    password: '',
    department: '',
    designation: '',
    division: '',
    dateOfJoining: '',
    status: 'active',
    reportingTo: [] // array of manager IDs
  })
  const [touched, setTouched] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    Promise.all([
      api.get('/meta/departments'),
      api.get('/meta/divisions'),
      api.get('/meta/designations')
    ])
      .then(([d, v, g]) => {
        const designations = (g.data || []).slice().sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
        setMeta({ departments: d.data || [], divisions: v.data || [], designations })
      })
      .catch(() => {})
      .finally(() => setLoadingMeta(false))
  }, [])

  // ---- validation rules ----
  const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim())
  const hasOnly8Chars = (p) => typeof p === 'string' && p.length === 8

  const errors = useMemo(() => {
    const e = {}
    if (!form.name.trim()) e.name = 'Full name is required'
    if (!form.email.trim()) e.email = 'Email is required'
    else if (!emailOk(form.email)) e.email = 'Enter a valid email'
    if (!form.password) e.password = 'Password is required'
    else if (!hasOnly8Chars(form.password)) e.password = 'Password must be exactly 8 characters'
    if (form.empId && form.empId.trim().length < 2) e.empId = 'Employee ID seems too short'
    if (form.dateOfJoining) {
      const d = new Date(form.dateOfJoining)
      const today = new Date(); today.setHours(0,0,0,0)
      if (isNaN(d.getTime())) e.dateOfJoining = 'Invalid date'
      else if (d > today) e.dateOfJoining = 'Date cannot be in the future'
    }
    if (!STATUS_OPTIONS.includes(form.status)) e.status = 'Invalid status'
    return e
  }, [form])

  const isInvalid = Object.keys(errors).length > 0
  const setF = (patch) => setForm(f => ({ ...f, ...patch }))
  const touch = (k) => setTouched(t => ({ ...t, [k]: true }))

  // ---- manager search (debounced, friendly fallbacks) ----
  useEffect(() => {
    const raw = managerQ ?? ''
    const q = raw.trim()
    if (q.length < MGR_MIN_CHARS) {
      setManagerResults([])
      return
    }
    const t = setTimeout(async () => {
      try {
        setSearchingMgrs(true)
        const { data } = await api.get('/users', { params: { q, limit: 10 } })
        setManagerResults(data.items || [])
      } catch {
        setManagerResults([])
      } finally {
        setSearchingMgrs(false)
      }
    }, MGR_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [managerQ])

  const addManager = (u) => {
    // u is full user object
    const id = u._id
    // add id into form (unique)
    setF({ reportingTo: Array.from(new Set([...(form.reportingTo || []), id])) })
    // add full object for display (unique by _id)
    setSelectedManagers((prev) => {
      const has = prev.some(p => p._id === id)
      return has ? prev : [...prev, { _id: id, name: u.name, empId: u.empId, email: u.email }]
    })
  }

  const removeManager = (id) => {
    setF({ reportingTo: (form.reportingTo || []).filter(x => x !== id) })
    setSelectedManagers(list => list.filter(m => m._id !== id))
  }

  // ---- submit ----
  const onSubmit = async (e) => {
    e.preventDefault()
    setMsg(null)
    setTouched({
      name: true, email: true, password: true, empId: true,
      department: true, designation: true, division: true, dateOfJoining: true, status: true
    })
    if (isInvalid) return
    try {
      setSubmitting(true)
      await api.post('/users', form)
      setMsg('✅ User created successfully')
      setForm({
        name: '', empId: '', email: '', password: '',
        department: '', designation: '', division: '',
        dateOfJoining: '', status: 'active', reportingTo: []
      })
      setManagerQ(''); setManagerResults([]); setSelectedManagers([])
    } catch (e) {
      setMsg(e.response?.data?.error || 'Failed to create user')
    } finally {
      setSubmitting(false)
      setTimeout(() => setMsg(null), 3000)
    }
  }

  const onPasswordChange = (val) => {
    const next = val.slice(0, 8)
    setF({ password: next })
  }

  return (
    <div className="min-h-full bg-gray-50">
      <Navbar />
      <div className="page">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-xl font-semibold">Add User</div>
          <div className="text-xs text-gray-500">Fields marked * are required</div>
        </div>

        {msg && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
            {msg}
          </div>
        )}

        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Left column */}
          <section className="lg:col-span-2 space-y-4">
            <Card title="Basic Information">
              <Field label="Full Name *" error={touched.name && errors.name} hint="Use the employee’s legal name">
                <input className="input" value={form.name} onChange={e => setF({ name: e.target.value })} onBlur={() => touch('name')} required />
              </Field>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Email *" error={touched.email && errors.email} hint="Work email preferred">
                  <input className="input" type="email" value={form.email} onChange={e => setF({ email: e.target.value })} onBlur={() => touch('email')} required />
                </Field>
                <Field label="Employee ID" error={touched.empId && errors.empId}>
                  <input className="input" value={form.empId} onChange={e => setF({ empId: e.target.value })} onBlur={() => touch('empId')} placeholder="e.g., EMP1032" />
                </Field>
              </div>

              <Field label="Password (exactly 8 chars) *" error={touched.password && errors.password} hint="Temporary 8-character password; user can change later">
                <div className="relative">
                  <input
                    className="input pr-14" type="password" value={form.password}
                    onChange={e => onPasswordChange(e.target.value)} onBlur={() => touch('password')}
                    minLength={8} maxLength={8} required autoComplete="new-password"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-gray-500">
                    {form.password.length}/8
                  </div>
                </div>
              </Field>
            </Card>

            <Card title="Employment Details">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Department">
                  <Select value={form.department} onChange={v => setF({ department: v })} onBlur={() => touch('department')} loading={loadingMeta} options={meta.departments} />
                </Field>
                <Field label="Designation">
                  <Select value={form.designation} onChange={v => setF({ designation: v })} onBlur={() => touch('designation')} loading={loadingMeta} options={meta.designations} optionLabel="name" />
                </Field>
                <Field label="Division">
                  <Select value={form.division} onChange={v => setF({ division: v })} onBlur={() => touch('division')} loading={loadingMeta} options={meta.divisions} />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Date of Joining" error={touched.dateOfJoining && errors.dateOfJoining}>
                  <input className="input" type="date" value={form.dateOfJoining} onChange={e => setF({ dateOfJoining: e.target.value })} onBlur={() => touch('dateOfJoining')} />
                </Field>
                <Field label="Status" error={touched.status && errors.status}>
                  <select className="select" value={form.status} onChange={e => setF({ status: e.target.value })} onBlur={() => touch('status')}>
                    {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
            </Card>

            <Card title="Reporting To">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  className="input"
                  placeholder={`Search managers… (min ${MGR_MIN_CHARS} chars)`}
                  value={managerQ}
                  onChange={e => setManagerQ(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); /* instant search */ setManagerQ(v => v); } }}
                />
                <button
                  type="button"
                  className="btn btn-ghost w-full sm:w-auto"
                  onClick={() => setManagerQ(v => v.trim())}
                  disabled={searchingMgrs}
                  title="Search now"
                >
                  {searchingMgrs ? 'Searching…' : 'Search'}
                </button>
                {managerQ && (
                  <button type="button" className="btn btn-ghost w-full sm:w-auto" onClick={() => { setManagerQ(''); setManagerResults([]) }}>
                    Clear
                  </button>
                )}
              </div>

              <div className="mt-2 min-h-[44px]">
                {/* helper / states */}
                {managerQ.trim().length === 0 && (
                  <div className="text-sm text-gray-500">Type at least {MGR_MIN_CHARS} characters to search.</div>
                )}
                {managerQ.trim().length > 0 && managerQ.trim().length < MGR_MIN_CHARS && (
                  <div className="text-sm text-gray-500">Keep typing… {MGR_MIN_CHARS - managerQ.trim().length} more</div>
                )}
                {managerQ.trim().length >= MGR_MIN_CHARS && !searchingMgrs && managerResults.length === 0 && (
                  <div className="text-sm text-gray-500">No matches. Try another name or email.</div>
                )}

                {/* results */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {managerResults.map(u => (
                    <button
                      type="button"
                      key={u._id}
                      className="badge border-gray-300 hover:bg-gray-100"
                      onClick={() => addManager(u)}
                      title="Add as manager"
                    >
                      + {u.name} {u.empId ? `(${u.empId})` : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* selected managers (names, not IDs) */}
              {selectedManagers.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-xs font-medium text-gray-600">
                    Selected managers ({selectedManagers.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedManagers.map(m => (
                      <span key={m._id} className="badge border-gray-300">
                        {m.name} {m.empId ? `(${m.empId})` : ''}
                        <button
                          type="button"
                          className="ml-1 rounded px-1 text-gray-500 hover:bg-gray-100"
                          onClick={() => removeManager(m._id)}
                          title="Remove"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </section>

          {/* Right column: live validation + submit */}
          <section className="space-y-4">
            <Card title="Review & Submit">
              <div className="mb-3 text-sm text-gray-600">
                Please review the details. We validate common issues before sending to the server.
              </div>

              {isInvalid ? (
                <ul className="mb-3 list-disc pl-5 text-sm text-rose-700">
                  {Object.entries(errors).map(([k, v]) => <li key={k}>{v}</li>)}
                </ul>
              ) : (
                <div className="mb-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">
                  All good — ready to create.
                </div>
              )}

              <button className="btn btn-primary w-full" type="submit" disabled={submitting || isInvalid}>
                {submitting ? 'Creating…' : 'Create User'}
              </button>

              <button
                type="button"
                className="btn btn-ghost mt-2 w-full"
                onClick={() => {
                  setForm({
                    name: '', empId: '', email: '', password: '',
                    department: '', designation: '', division: '',
                    dateOfJoining: '', status: 'active', reportingTo: []
                  })
                  setTouched({})
                  setManagerQ(''); setManagerResults([]); setSelectedManagers([])
                }}
              >
                Reset Form
              </button>
            </Card>

            <Card title="Tips">
              <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                <li>Password must be exactly 8 characters (temporary is fine).</li>
                <li>Designation ordering follows your priority set in Superadmin.</li>
                <li>You can add multiple managers — each click adds a manager.</li>
              </ul>
            </Card>
          </section>
        </form>
      </div>
    </div>
  )
}

/* ---------------- UI bits ---------------- */

function Card({ title, children }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm backdrop-blur">
      {title && <div className="mb-3 text-base font-semibold">{title}</div>}
      {children}
    </div>
  )
}

function Field({ label, error, hint, children }) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium text-gray-700">{label}</div>
      {children}
      {error ? (
        <div className="mt-1 text-xs text-rose-600">{error}</div>
      ) : hint ? (
        <div className="mt-1 text-xs text-gray-500">{hint}</div>
      ) : null}
    </div>
  )
}

function Select({ value, onChange, onBlur, loading, options = [], optionLabel = 'name' }) {
  return (
    <select
      className="select"
      value={value}
      onChange={e => onChange?.(e.target.value)}
      onBlur={onBlur}
      disabled={loading}
    >
      <option value="">{loading ? 'Loading…' : '— Select —'}</option>
      {options.map(o => (
        <option key={o._id} value={o._id}>
          {o[optionLabel] || '—'}
        </option>
      ))}
    </select>
  )
}
