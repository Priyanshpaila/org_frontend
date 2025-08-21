import React, { useMemo } from 'react'
import ReactFlow, { MiniMap, Controls, Background } from 'reactflow'
import 'reactflow/dist/style.css'

export default function OrgTree({ data = [], mode = 'subtree' }) {
  const { nodes, edges } = useMemo(() => {
    const nodes = []
    const edges = []
    if (!data?.length) return { nodes, edges }

    const byId = new Map(data.map(d => [String(d._id), d]))
    const grouped = {}
    data.forEach(u => {
      const depth = u.depth || 0
      grouped[depth] = grouped[depth] || []
      grouped[depth].push(u)
    })
    Object.keys(grouped).forEach(k => {
      const depth = parseInt(k, 10)
      const row = grouped[k]
      row.forEach((u, idx) => {
        nodes.push({
          id: String(u._id),
          position: { x: idx * 250, y: depth * 140 },
          data: { label: nodeLabel(u) },
          style: { padding: 8, borderRadius: 16, border: '1px solid #e5e7eb', background: 'white', width: 220 }
        })
      })
    })
    if (mode === 'subtree') {
      data.forEach(u => {
        (u.reportingTo || []).forEach(mgr => {
          const mId = typeof mgr === 'string' ? mgr : mgr._id
          if (byId.has(String(mId))) edges.push({ id: `${mId}->${u._id}`, source: String(mId), target: String(u._id) })
        })
      })
    }
    return { nodes, edges }
  }, [data, mode])

  return (
    <div className="card h-[520px] w-full overflow-hidden">
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <MiniMap pannable zoomable />
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  )
}

function nodeLabel(u) {
  return (
    <div className="text-sm">
      <div className="font-semibold">{u.name}</div>
      <div className="text-xs text-gray-600">{u.designation?.name || '—'}</div>
      <div className="mt-1 text-[10px] text-gray-500">{u.empId || u.email}</div>
    </div>
  )
}
