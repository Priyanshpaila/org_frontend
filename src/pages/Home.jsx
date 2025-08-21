import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import SearchBar from '../components/SearchBar.jsx'
import UserDetailsTable from '../components/UserDetailsTable.jsx'
import OrgTree from '../components/OrgTree.jsx'
import api from '../lib/api.js'

export default function Home() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [subtree, setSubtree] = useState([])
  const [roots, setRoots] = useState([])

  const runSearch = async () => {
    const { data } = await api.get('/users', { params: { q, limit: 10 } })
    setResults(data.items || [])
    setSelected(data.items?.[0] || null)
  }

  const loadSubtree = async (id) => {
    if (!id) return
    const { data } = await api.get(`/users/${id}/subtree`, { params: { depth: 3 } })
    setSubtree(data)
  }

  useEffect(() => { api.get('/users/roots').then(({ data }) => setRoots(data)) }, [])
  useEffect(() => { if (selected?._id) loadSubtree(selected._id) }, [selected?._id])

  return (
    <div className="min-h-full bg-gray-50">
      <Navbar />
      <div className="page">
        <div className="mb-4 flex items-center justify-between gap-3">
          <SearchBar value={q} onChange={setQ} onSubmit={runSearch} />
          {results?.length > 0 && (
            <select className="select w-60" value={selected?._id || ''} onChange={e => setSelected(results.find(r => r._id === e.target.value))}>
              {results.map(r => <option key={r._id} value={r._id}>{r.name} ({r.empId || r.email})</option>)}
            </select>
          )}
        </div>
        {!q && <><div className="mb-3 text-lg font-semibold">Main Org Tree</div><OrgTree data={roots} mode="roots" /></>}
        {q && selected && <><UserDetailsTable user={selected} /><div className="mt-4 mb-2 text-lg font-semibold">Hierarchy around {selected.name}</div><OrgTree data={subtree} mode="subtree" /></>}
      </div>
    </div>
  )
}
