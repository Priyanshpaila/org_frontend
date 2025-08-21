import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import api from '../lib/api.js'
import { useAuthStore } from '../store/authStore.js'
import RoleBadge from '../components/RoleBadge.jsx'
import { useNavigate } from 'react-router-dom'

export default function SuperAdmin() {
  const isSuper = useAuthStore(s => s.isSuperAdmin())
  const nav = useNavigate()
  useEffect(() => { if (!isSuper) nav('/') }, [isSuper])

  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [divisions, setDivisions] = useState([])
  const [designations, setDesignations] = useState([])

  const [msg, setMsg] = useState(null)

  // Create forms
  const [newDept, setNewDept] = useState({ name: '', code: '' })
  const [newDiv, setNewDiv] = useState({ name: '', code: '' })
  const [newDesig, setNewDesig] = useState({ name: '', priority: 1, description: '' })

  // Edit states
  const [editDeptId, setEditDeptId] = useState(null)
  const [editDept, setEditDept] = useState({ name: '', code: '' })

  const [editDivId, setEditDivId] = useState(null)
  const [editDiv, setEditDiv] = useState({ name: '', code: '' })

  const [editDesigId, setEditDesigId] = useState(null)
  const [editDesig, setEditDesig] = useState({ name: '', priority: 1, description: '' })

  const load = async () => {
    const [
      { data: u },
      { data: dept },
      { data: div },
      { data: desig }
    ] = await Promise.all([
      api.get('/users', { params: { limit: 200 } }),
      api.get('/meta/departments'),
      api.get('/meta/divisions'),
      api.get('/meta/designations')
    ])
    setUsers(u.items || [])
    setDepartments(dept || [])
    setDivisions(div || [])
    // ensure sort by priority asc for nicer display
    setDesignations((desig || []).slice().sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999)))
  }
  useEffect(() => { load() }, [])

  const toast = (t) => { setMsg(t); setTimeout(() => setMsg(null), 2500) }

  // ------- USER ROLES -------
  const changeRole = async (id, role) => {
    try { await api.patch(`/users/${id}/role`, { role }); toast('Role updated'); load() }
    catch (e) { toast(e.response?.data?.error || 'Failed to change role') }
  }

  // ------- DESIGNATION REORDER -------
  const move = (idx, dir) => {
    const next = [...designations]
    const j = idx + dir
    if (j < 0 || j >= next.length) return
    const temp = next[idx]; next[idx] = next[j]; next[j] = temp
    next.forEach((d, i) => d.priority = i + 1)
    setDesignations(next)
  }
  const saveReorder = async () => {
    try {
      const body = { items: designations.map(d => ({ id: d._id, priority: d.priority })) }
      await api.patch('/meta/designations/reorder', body)
      toast('Designations reordered'); load()
    } catch (e) { toast(e.response?.data?.error || 'Failed to reorder') }
  }

  // ------- DEPARTMENTS CRUD -------
  const createDept = async (e) => {
    e.preventDefault()
    try { await api.post('/meta/departments', newDept); setNewDept({ name: '', code: '' }); toast('Department created'); load() }
    catch (e) { toast(e.response?.data?.error || 'Failed to create department') }
  }
  const startEditDept = (d) => { setEditDeptId(d._id); setEditDept({ name: d.name || '', code: d.code || '' }) }
  const saveDept = async (id) => {
    try { await api.patch(`/meta/departments/${id}`, editDept); setEditDeptId(null); toast('Department updated'); load() }
    catch (e) { toast(e.response?.data?.error || 'Failed to update department') }
  }
  const deleteDept = async (id) => {
    if (!confirm('Delete this department?')) return
    try { await api.delete(`/meta/departments/${id}`); toast('Department deleted'); load() }
    catch (e) { toast(e.response?.data?.error || 'Failed to delete department') }
  }

  // ------- DIVISIONS CRUD -------
  const createDiv = async (e) => {
    e.preventDefault()
    try { await api.post('/meta/divisions', newDiv); setNewDiv({ name: '', code: '' }); toast('Division created'); load() }
    catch (e) { toast(e.response?.data?.error || 'Failed to create division') }
  }
  const startEditDiv = (d) => { setEditDivId(d._id); setEditDiv({ name: d.name || '', code: d.code || '' }) }
  const saveDiv = async (id) => {
    try { await api.patch(`/meta/divisions/${id}`, editDiv); setEditDivId(null); toast('Division updated'); load() }
    catch (e) { toast(e.response?.data?.error || 'Failed to update division') }
  }
  const deleteDiv = async (id) => {
    if (!confirm('Delete this division?')) return
    try { await api.delete(`/meta/divisions/${id}`); toast('Division deleted'); load() }
    catch (e) { toast(e.response?.data?.error || 'Failed to delete division') }
  }

  // ------- DESIGNATIONS CRUD -------
  const createDesig = async (e) => {
    e.preventDefault()
    try {
      const body = { ...newDesig, priority: Number(newDesig.priority) || 1 }
      await api.post('/meta/designations', body)
      setNewDesig({ name: '', priority: 1, description: '' })
      toast('Designation created'); load()
    } catch (e) { toast(e.response?.data?.error || 'Failed to create designation') }
  }
  const startEditDesig = (d) => {
    setEditDesigId(d._id)
    setEditDesig({ name: d.name || '', priority: d.priority || 1, description: d.description || '' })
  }
  const saveDesig = async (id) => {
    try {
      const body = { ...editDesig, priority: Number(editDesig.priority) || 1 }
      await api.patch(`/meta/designations/${id}`, body)
      setEditDesigId(null)
      toast('Designation updated'); load()
    } catch (e) { toast(e.response?.data?.error || 'Failed to update designation') }
  }
  const deleteDesig = async (id) => {
    if (!confirm('Delete this designation?')) return
    try { await api.delete(`/meta/designations/${id}`); toast('Designation deleted'); load() }
    catch (e) { toast(e.response?.data?.error || 'Failed to delete designation') }
  }

  return (
    <div className="min-h-full bg-gray-50">
      <Navbar />
      <div className="page">
        <div className="mb-2 text-xl font-semibold">Superadmin Dashboard</div>
        {msg && <div className="mb-3 rounded-xl bg-amber-50 p-2 text-sm text-amber-800">{msg}</div>}

        {/* Row 1: Users + Reorder */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="card p-4">
            <div className="mb-2 font-semibold">Users</div>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="p-2">Name</th>
                    <th className="p-2">Email</th>
                    <th className="p-2">Role</th>
                    <th className="p-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id} className="border-t">
                      <td className="p-2">{u.name}</td>
                      <td className="p-2">{u.email}</td>
                      <td className="p-2"><RoleBadge role={u.role} /></td>
                      <td className="p-2">
                        {u.role !== 'superadmin' && (
                          <select
                            className="select w-36"
                            value={u.role}
                            onChange={e => changeRole(u._id, e.target.value)}
                          >
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-4">
            <div className="mb-2 font-semibold">Designation Priority (Drag-like controls)</div>
            <div className="space-y-2">
              {designations.map((d, idx) => (
                <div key={d._id} className="flex items-center justify-between rounded-xl border p-2">
                  <div>
                    <div className="font-medium">{d.name}</div>
                    <div className="text-xs text-gray-500">priority: {d.priority}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost" onClick={() => move(idx, -1)}>↑</button>
                    <button className="btn btn-ghost" onClick={() => move(idx, +1)}>↓</button>
                  </div>
                </div>
              ))}
              <button className="btn btn-primary" onClick={saveReorder}>Save Order</button>
            </div>
          </div>
        </div>

        {/* Row 2: Departments + Divisions */}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Departments */}
          <div className="card p-4">
            <div className="mb-2 text-lg font-semibold">Departments</div>
            <form className="mb-3 grid grid-cols-3 gap-2" onSubmit={createDept}>
              <input className="input col-span-2" placeholder="Name" value={newDept.name}
                     onChange={e => setNewDept(v => ({ ...v, name: e.target.value }))} required />
              <input className="input" placeholder="Code" value={newDept.code}
                     onChange={e => setNewDept(v => ({ ...v, code: e.target.value }))} />
              <button className="btn btn-primary col-span-3 md:col-span-1" type="submit">Add</button>
            </form>
            <div className="max-h-[320px] overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="p-2">Name</th>
                    <th className="p-2">Code</th>
                    <th className="p-2 w-40">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map(d => (
                    <tr key={d._id} className="border-t">
                      <td className="p-2">
                        {editDeptId === d._id
                          ? <input className="input" value={editDept.name} onChange={e => setEditDept(v => ({ ...v, name: e.target.value }))} />
                          : d.name}
                      </td>
                      <td className="p-2">
                        {editDeptId === d._id
                          ? <input className="input" value={editDept.code || ''} onChange={e => setEditDept(v => ({ ...v, code: e.target.value }))} />
                          : (d.code || '—')}
                      </td>
                      <td className="p-2">
                        {editDeptId === d._id ? (
                          <div className="flex gap-2">
                            <button className="btn btn-primary" onClick={() => saveDept(d._id)}>Save</button>
                            <button className="btn btn-ghost" onClick={() => setEditDeptId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button className="btn btn-ghost" onClick={() => startEditDept(d)}>Edit</button>
                            <button className="btn btn-ghost" onClick={() => deleteDept(d._id)}>Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Divisions */}
          <div className="card p-4">
            <div className="mb-2 text-lg font-semibold">Divisions</div>
            <form className="mb-3 grid grid-cols-3 gap-2" onSubmit={createDiv}>
              <input className="input col-span-2" placeholder="Name" value={newDiv.name}
                     onChange={e => setNewDiv(v => ({ ...v, name: e.target.value }))} required />
              <input className="input" placeholder="Code" value={newDiv.code}
                     onChange={e => setNewDiv(v => ({ ...v, code: e.target.value }))} />
              <button className="btn btn-primary col-span-3 md:col-span-1" type="submit">Add</button>
            </form>
            <div className="max-h-[320px] overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="p-2">Name</th>
                    <th className="p-2">Code</th>
                    <th className="p-2 w-40">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {divisions.map(d => (
                    <tr key={d._id} className="border-t">
                      <td className="p-2">
                        {editDivId === d._id
                          ? <input className="input" value={editDiv.name} onChange={e => setEditDiv(v => ({ ...v, name: e.target.value }))} />
                          : d.name}
                      </td>
                      <td className="p-2">
                        {editDivId === d._id
                          ? <input className="input" value={editDiv.code || ''} onChange={e => setEditDiv(v => ({ ...v, code: e.target.value }))} />
                          : (d.code || '—')}
                      </td>
                      <td className="p-2">
                        {editDivId === d._id ? (
                          <div className="flex gap-2">
                            <button className="btn btn-primary" onClick={() => saveDiv(d._id)}>Save</button>
                            <button className="btn btn-ghost" onClick={() => setEditDivId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button className="btn btn-ghost" onClick={() => startEditDiv(d)}>Edit</button>
                            <button className="btn btn-ghost" onClick={() => deleteDiv(d._id)}>Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Row 3: Designations CRUD */}
        <div className="mt-4 card p-4">
          <div className="mb-2 text-lg font-semibold">Designations (CRUD)</div>

          <form className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-4" onSubmit={createDesig}>
            <input className="input" placeholder="Name" value={newDesig.name}
                   onChange={e => setNewDesig(v => ({ ...v, name: e.target.value }))} required />
            <input className="input" type="number" min="1" placeholder="Priority" value={newDesig.priority}
                   onChange={e => setNewDesig(v => ({ ...v, priority: e.target.value }))} required />
            <input className="input md:col-span-2" placeholder="Description (optional)" value={newDesig.description}
                   onChange={e => setNewDesig(v => ({ ...v, description: e.target.value }))} />
            <button className="btn btn-primary md:col-span-1" type="submit">Add</button>
          </form>

          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="p-2">Name</th>
                  <th className="p-2">Priority</th>
                  <th className="p-2">Description</th>
                  <th className="p-2 w-40">Actions</th>
                </tr>
              </thead>
              <tbody>
                {designations.map(d => (
                  <tr key={d._id} className="border-t">
                    <td className="p-2">
                      {editDesigId === d._id
                        ? <input className="input" value={editDesig.name} onChange={e => setEditDesig(v => ({ ...v, name: e.target.value }))} />
                        : d.name}
                    </td>
                    <td className="p-2">
                      {editDesigId === d._id
                        ? <input className="input w-24" type="number" min="1" value={editDesig.priority}
                                 onChange={e => setEditDesig(v => ({ ...v, priority: e.target.value }))} />
                        : d.priority}
                    </td>
                    <td className="p-2">
                      {editDesigId === d._id
                        ? <input className="input" value={editDesig.description || ''} onChange={e => setEditDesig(v => ({ ...v, description: e.target.value }))} />
                        : (d.description || '—')}
                    </td>
                    <td className="p-2">
                      {editDesigId === d._id ? (
                        <div className="flex gap-2">
                          <button className="btn btn-primary" onClick={() => saveDesig(d._id)}>Save</button>
                          <button className="btn btn-ghost" onClick={() => setEditDesigId(null)}>Cancel</button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button className="btn btn-ghost" onClick={() => startEditDesig(d)}>Edit</button>
                          <button className="btn btn-ghost" onClick={() => deleteDesig(d._id)}>Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-xs text-gray-600">
            Tip: You can either edit a designation’s priority here (then “Save”), or use the “Designation Priority” block above to reorder many at once and click “Save Order”.
          </div>
        </div>
      </div>
    </div>
  )
}
