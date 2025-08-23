import { useEffect, useMemo, useRef, useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import SearchBar from '../components/SearchBar.jsx'
import RoleBadge from '../components/RoleBadge.jsx'
import api from '../lib/api.js'
import { useAuthStore } from '../store/authStore.js'

export default function Users() {
  const { isAdmin, isSuperAdmin, user: me } = useAuthStore()
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState([])

  // modal state
  const [showModal, setShowModal] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [activeUser, setActiveUser] = useState(null)
  const [working, setWorking] = useState(false)
  const canHardDelete = isSuperAdmin?.() === true
  const canSoftDelete = isAdmin?.() === true || canHardDelete

  // lock body scroll when modal opens
  useEffect(() => {
    if (!showModal) return
    const prevHtml = document.documentElement.style.overflow
    const prevBody = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = prevHtml || ''
      document.body.style.overflow = prevBody || ''
    }
  }, [showModal])

  const toast = (msg) => {
    // simple toast banner
    setBanner(msg)
    clearTimeout(toast._t)
    toast._t = setTimeout(() => setBanner(null), 2500)
  }
  const [banner, setBanner] = useState(null)

  // list loader
  const loadUsers = async (query = '') => {
    try {
      setLoading(true)
      const params = { limit: 200 }
      if (query?.trim()) params.q = query.trim()
      const { data } = await api.get('/users', { params })
      setUsers(data.items || [])
    } catch (e) {
      setUsers([])
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers('') }, [])

  const runSearch = async (normQ) => {
    // SearchBar may pass a normalized query; fall back to local state
    const query = typeof normQ === 'string' ? normQ : q.trim()
    if (!query) return loadUsers('')
    return loadUsers(query)
  }

  const openUser = async (id) => {
    setActiveId(id)
    setShowModal(true)
    try {
      const { data } = await api.get(`/users/${id}`)
      setActiveUser(data)
    } catch (e) {
      setShowModal(false)
      setActiveId(null)
      setActiveUser(null)
      toast(e.response?.data?.error || 'Failed to load user')
    }
  }
  const closeModal = () => { setShowModal(false); setActiveId(null); setActiveUser(null) }

  const softDelete = async () => {
    if (!canSoftDelete || !activeUser?._id) return
    if (!confirm(`Soft delete ${activeUser.name}?`)) return
    try {
      setWorking(true)
      await api.patch(`/users/${activeUser._id}`, { isDeleted: true }) // backend UpdateUser accepts this
      toast('User soft-deleted')
      await loadUsers(q)
      const { data } = await api.get(`/users/${activeUser._id}`)
      setActiveUser(data)
    } catch (e) {
      toast(e.response?.data?.error || 'Failed to soft delete')
    } finally {
      setWorking(false)
    }
  }

  const restore = async () => {
    if (!activeUser?._id) return
    try {
      setWorking(true)
      await api.patch(`/users/${activeUser._id}`, { isDeleted: false })
      toast('User restored')
      await loadUsers(q)
      const { data } = await api.get(`/users/${activeUser._id}`)
      setActiveUser(data)
    } catch (e) {
      toast(e.response?.data?.error || 'Failed to restore')
    } finally {
      setWorking(false)
    }
  }

  const hardDelete = async () => {
    if (!canHardDelete || !activeUser?._id) return
    if (activeUser.role === 'superadmin') return toast('Cannot delete a superadmin')
    if (activeUser._id === me?._id) return toast('You cannot delete your own account')
    if (!confirm(`Permanently delete ${activeUser.name}? This cannot be undone.`)) return
    try {
      setWorking(true)
      await api.delete(`/users/${activeUser._id}`)
      toast('User permanently deleted')
      closeModal()
      loadUsers(q)
    } catch (e) {
      toast(e.response?.data?.error || 'Failed to hard delete')
    } finally {
      setWorking(false)
    }
  }

  /* ---------- UI helpers ---------- */
  const fmt = (d) => (d ? new Date(d).toLocaleDateString() : '—')
  const filteredCount = useMemo(() => users.length, [users])

  return (
    <div className="min-h-full bg-gray-50">
      <Navbar />

      <div className="page">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Users</div>
            <div className="text-xs text-gray-500">{filteredCount} result{filteredCount === 1 ? '' : 's'}</div>
          </div>
          <SearchBar
            value={q}
            onChange={setQ}
            onSubmit={runSearch}
            onClear={() => { setQ(''); loadUsers('') }}
            isLoading={loading}
            allowEmptySubmit={true}
            minChars={2}
            debounceMs={400}
            caseInsensitive={true}
          />
        </div>

        {banner && (
          <div className="mb-3 rounded-xl bg-amber-50 border border-amber-200 p-2 text-sm text-amber-800">{banner}</div>
        )}

        {/* Mobile: cards */}
        <div className="md:hidden space-y-2">
          {users.map(u => (
            <button
              key={u._id}
              onClick={() => openUser(u._id)}
              className="w-full rounded-2xl border border-gray-200 bg-white p-3 text-left shadow-sm hover:shadow transition"
              title="View details"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium truncate">{u.name}</div>
                <RoleBadge role={u.role} />
              </div>
              <div className="text-xs text-gray-600 break-all">{u.email}</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="badge">{u.status || 'active'}</span>
              </div>
            </button>
          ))}
          {users.length === 0 && !loading && (
            <div className="card p-4 text-sm text-gray-600">No users found.</div>
          )}
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block">
          <div className="card p-4">
            <div className="overflow-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="p-2">Name</th>
                    <th className="p-2">Email</th>
                    <th className="p-2">Role</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id} className="border-t">
                      <td className="p-2">
                        <button
                          className="max-w-[280px] truncate underline underline-offset-2 hover:text-blue-700"
                          onClick={() => openUser(u._id)}
                        >
                          {u.name}
                        </button>
                      </td>
                      <td className="p-2 break-all">{u.email}</td>
                      <td className="p-2"><RoleBadge role={u.role} /></td>
                      <td className="p-2"><span className="badge">{u.status || 'active'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && !loading && (
                <div className="p-4 text-sm text-gray-600">No users found.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* -------- Modal: User details + actions -------- */}
      {showModal && (
        <div className="fixed inset-0 z-50 grid place-items-center p-3 sm:p-6">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div
            role="dialog"
            aria-modal="true"
            className="
              relative z-10 w-full max-w-[46rem] md:max-w-[56rem]
              max-h-[calc(100svh-1.5rem)] sm:max-h-[calc(100svh-3rem)]
              overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl
            "
          >
            {!activeUser ? (
              <div className="p-6 text-sm text-gray-600">Loading…</div>
            ) : (
              <>
                <div className="mb-4 flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-xl font-semibold truncate">{activeUser.name}</div>
                      {canHardDelete && activeUser.isDeleted && (
                        <span className="badge bg-rose-50 text-rose-700 border border-rose-200">soft-deleted</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 break-all">
                      {activeUser.empId ? `${activeUser.empId} • ` : ''}{activeUser.email}
                    </div>
                  </div>
                  <button className="btn btn-ghost" onClick={closeModal}>✕</button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Info label="Role" value={<RoleBadge role={activeUser.role} />} />
                  <Info label="Status" value={activeUser.status || 'active'} />
                  <Info label="Department" value={activeUser.department?.name || '—'} />
                  <Info label="Division" value={activeUser.division?.name || '—'} />
                  <Info label="Designation" value={activeUser.designation?.name || '—'} />
                  <Info label="Date of Joining" value={fmt(activeUser.dateOfJoining)} />
                  <div className="md:col-span-2">
                    <div className="mb-1 text-xs font-medium text-gray-500">Reporting To</div>
                    <div className="rounded-xl border p-2 text-sm">
                      {Array.isArray(activeUser.reportingTo) && activeUser.reportingTo.length > 0
                        ? activeUser.reportingTo.map(r => (
                            <div key={r._id}>
                              {r.name} {r.empId ? `(${r.empId})` : ''}
                            </div>
                          ))
                        : '—'}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  {canSoftDelete && !activeUser.isDeleted && (
                    <button
                      className="btn bg-amber-500 text-white hover:bg-amber-600"
                      disabled={working}
                      onClick={softDelete}
                    >
                      Soft Delete
                    </button>
                  )}
                  {canHardDelete && activeUser.isDeleted && (
                    <button
                      className="btn btn-ghost"
                      disabled={working}
                      onClick={restore}
                    >
                      Restore
                    </button>
                  )}
                  {canHardDelete && (
                    <button
                      className="btn bg-rose-600 text-white hover:bg-rose-700"
                      disabled={working || activeUser.role === 'superadmin' || activeUser._id === me?._id}
                      onClick={hardDelete}
                      title={
                        activeUser.role === 'superadmin'
                          ? 'Cannot delete a superadmin'
                          : activeUser._id === me?._id
                          ? 'You cannot delete your own account'
                          : 'Delete permanently'
                      }
                    >
                      Hard Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- tiny presentational helpers ---------- */
function Info({ label, value }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-gray-500">{label}</div>
      <div className="rounded-xl border p-2 text-sm break-words">{value ?? '—'}</div>
    </div>
  )
}
