import React, { useMemo, useCallback } from 'react'
import ReactFlow, {  Controls, Background, MarkerType } from 'reactflow'
import 'reactflow/dist/style.css'

/**
 * Usage:
 * <OrgTree data={arrayOfUsers} mode="subtree" onNodeClick={(user) => ...} />
 *
 * data: users with fields: _id, name, designation?.name, empId/email, depth, reportingTo (ids or populated objs)
 * mode: 'subtree' -> draws reporting edges, 'roots' -> shows cards only
 * onNodeClick: optional handler(user)
 */

export default function OrgTree({ data = [], mode = 'subtree', onNodeClick }) {
  const X_GAP = 260
  const Y_GAP = 160

  const colorOf = useCallback((u) => {
    // stable pastel color by designation priority or name hash
    const seed = (u?.designation?.priority ?? 99) + (u?.designation?.name?.length ?? 0)
    const palette = [
      '#EEF2FF', '#ECFEFF', '#F0FDF4', '#FFF7ED', '#FDF2F8', '#F5F5F5'
    ]
    const border = [
      '#6366F1', '#06B6D4', '#22C55E', '#F59E0B', '#EC4899', '#6B7280'
    ]
    const i = seed % palette.length
    return { fill: palette[i], stroke: border[i] }
  }, [])

  const initials = (u) => {
    const src = u?.name || ''
    const [a = '', b = ''] = src.split(' ')
    return (a[0] || '').toUpperCase() + (b[0] || '').toUpperCase()
  }

  const PersonNode = ({ data, selected }) => {
    const u = data.user
    const col = data.color
    return (
      <div
        className={[
          'w-[240px] rounded-2xl bg-white border shadow-sm transition',
          'hover:shadow-md hover:-translate-y-[1px]',
          selected ? 'ring-2 ring-brand-600' : 'ring-1 ring-transparent',
          'border-gray-200'
        ].join(' ')}
        onClick={() => data.onClick?.(u)}
      >
        {/* top accent */}
        <div
          className="h-1 rounded-t-2xl"
          style={{ background: col?.stroke || '#6366F1' }}
        />
        <div className="p-3 flex items-center gap-3">
          <div
            className="size-10 shrink-0 rounded-xl flex items-center justify-center text-sm font-semibold"
            style={{ background: col?.fill || '#EEF2FF', color: '#111827', border: `1px solid ${col?.stroke || '#6366F1'}` }}
          >
            {initials(u) || 'U'}
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold text-gray-900">{u?.name}</div>
            <div className="truncate text-xs text-gray-600">{u?.designation?.name || '—'}</div>
            <div className="truncate mt-0.5 text-[11px] text-gray-500">{u?.empId || u?.email}</div>
          </div>
        </div>
        <div className="px-3 pb-3">
          {/* <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-700">
            depth {u?.depth ?? 0}
          </span> */}
        </div>
      </div>
    )
  }

  const nodeTypes = useMemo(() => ({ person: PersonNode }), [])

  const { nodes, edges } = useMemo(() => {
    const nodes = []
    const edges = []
    if (!Array.isArray(data) || data.length === 0) return { nodes, edges }

    // group by depth
    const groups = new Map()
    const byId = new Map(data.map(u => [String(u._id), u]))
    data.forEach(u => {
      const d = Number.isFinite(u.depth) ? u.depth : 0
      if (!groups.has(d)) groups.set(d, [])
      groups.get(d).push(u)
    })

    const maxRow = Math.max(...Array.from(groups.values()).map(arr => arr.length))
    let maxDepth = Math.max(...Array.from(groups.keys()))

    // layout: center each row relative to the widest row
    for (let depth = 0; depth <= maxDepth; depth++) {
      const row = groups.get(depth) || []
      const count = row.length
      if (count === 0) continue
      const rowWidth = (count - 1) * X_GAP
      const maxWidth = (maxRow - 1) * X_GAP
      const offsetX = (maxWidth - rowWidth) / 2

      row.forEach((u, idx) => {
        const { fill, stroke } = colorOf(u)
        nodes.push({
          id: String(u._id),
          type: 'person',
          position: { x: offsetX + idx * X_GAP, y: depth * Y_GAP },
          data: {
            user: u,
            color: { fill, stroke },
            onClick: onNodeClick
          }
        })
      })
    }

    // edges only for subtree (full hierarchy)
    if (mode === 'subtree') {
      const seen = new Set()
      data.forEach(u => {
        const managers = Array.isArray(u.reportingTo) ? u.reportingTo : []
        managers.forEach(mgr => {
          const mid = String(typeof mgr === 'string' ? mgr : mgr?._id)
          const uid = String(u._id)
          if (!byId.has(mid)) return
          const id = `${mid}->${uid}`
          if (seen.has(id)) return
          seen.add(id)
          edges.push({
            id,
            source: mid,
            target: uid,
            type: 'smoothstep',
            animated: false,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#CBD5E1', width: 18, height: 18 },
            style: { stroke: '#CBD5E1', strokeWidth: 2 }
          })
        })
      })
    }

    return { nodes, edges }
  }, [data, mode, colorOf, onNodeClick])

  return (
    <div className="card w-full overflow-hidden h-[380px] md:h-[520px] lg:h-[640px]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        panOnScroll
        selectionOnDrag
      >
     
      </ReactFlow>
    </div>
  )
}
