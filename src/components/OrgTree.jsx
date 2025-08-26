import React, { useMemo, useCallback } from 'react'
import ReactFlow, { Controls, Background, MarkerType } from 'reactflow'
import 'reactflow/dist/style.css'

/**
 * <OrgTree
 *   data={users}
 *   mode="subtree" | "roots"
 *   showEdges={true}
 *   onNodeClick={(user) => ...}
 * />
 *
 * Draws edges from many shapes:
 * - reportingTo (ids or populated)
 * - reportingToId / manager / managerId
 * - ancestors (nearest present)
 * - children / reports / directReports / subordinates (fallback, downward)
 */

export default function OrgTree({
  data = [],
  mode = 'subtree',
  showEdges = true,
  onNodeClick,
}) {
  const X_GAP = 260
  const Y_GAP = 160

  const colorOf = useCallback((u) => {
    const seed = (u?.designation?.priority ?? 99) + (u?.designation?.name?.length ?? 0)
    const palette = ['#EEF2FF', '#ECFEFF', '#F0FDF4', '#FFF7ED', '#FDF2F8', '#F5F5F5']
    const border  = ['#6366F1', '#06B6D4', '#22C55E', '#F59E0B', '#EC4899', '#6B7280']
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
          'border-gray-200',
        ].join(' ')}
        onClick={() => data.onClick?.(u)}
      >
        <div className="h-1 rounded-t-2xl" style={{ background: col?.stroke || '#6366F1' }} />
        <div className="p-3 flex items-center gap-3">
          <div
            className="size-10 shrink-0 rounded-xl flex items-center justify-center text-sm font-semibold"
            style={{
              background: col?.fill || '#EEF2FF',
              color: '#111827',
              border: `1px solid ${col?.stroke || '#6366F1'}`,
            }}
          >
            {initials(u) || 'U'}
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold text-gray-900">{u?.name}</div>
            <div className="truncate text-xs text-gray-600">
              {u?.designation?.name || '—'}
            </div>
            <div className="truncate mt-0.5 text-[11px] text-gray-500">
              {u?.empId || u?.email}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const nodeTypes = useMemo(() => ({ person: PersonNode }), [])

  // ---- helpers to resolve ids & relations ----
  const toId = (x) =>
    typeof x === 'string' ? x : (x && (x._id || x.id)) ? String(x._id || x.id) : null

  const resolveManagerId = (u, byId) => {
    // 1) reportingTo array (ids or populated)
    if (Array.isArray(u?.reportingTo) && u.reportingTo.length) {
      for (const m of u.reportingTo) {
        const id = toId(m)
        if (id && byId.has(id)) return id
      }
    }
    // 2) common single-id variants
    const candidates = [u?.reportingToId, u?.managerId, u?.manager]
    for (const c of candidates) {
      const id = toId(c)
      if (id && byId.has(id)) return id
    }
    // 3) ancestors fallback: pick nearest ancestor present
    if (Array.isArray(u?.ancestors) && u.ancestors.length) {
      for (let i = u.ancestors.length - 1; i >= 0; i--) {
        const id = toId(u.ancestors[i])
        if (id && byId.has(id)) return id
      }
    }
    return null
  }

  // downward relations if present
  const childArrays = (u) => {
    const lists = [u?.children, u?.reports, u?.directReports, u?.subordinates]
    return lists.filter(Array.isArray).flat()
  }

  const { nodes, edges } = useMemo(() => {
    const nodes = []
    const edges = []
    if (!Array.isArray(data) || data.length === 0) return { nodes, edges }

    const byId = new Map(data.map((u) => [String(u._id), u]))

    // group by depth (default 0 if missing)
    const groups = new Map()
    data.forEach((u) => {
      const d = Number.isFinite(u.depth) ? u.depth : 0
      if (!groups.has(d)) groups.set(d, [])
      groups.get(d).push(u)
    })

    const maxRow = Math.max(...Array.from(groups.values()).map((arr) => arr.length))
    const maxDepth = Math.max(...Array.from(groups.keys()))

    // layout rows centered
    for (let depth = 0; depth <= maxDepth; depth++) {
      const row = groups.get(depth) || []
      if (!row.length) continue
      const rowWidth = (row.length - 1) * X_GAP
      const maxWidth = (maxRow - 1) * X_GAP
      const offsetX = (maxWidth - rowWidth) / 2

      row.forEach((u, idx) => {
        const { fill, stroke } = colorOf(u)
        nodes.push({
          id: String(u._id),
          type: 'person',
          position: { x: offsetX + idx * X_GAP, y: depth * Y_GAP },
          // These ensure edges attach top/bottom cleanly:
          sourcePosition: 'bottom',
          targetPosition: 'top',
          data: { user: u, color: { fill, stroke }, onClick: onNodeClick },
        })
      })
    }

    if (showEdges) {
      const seen = new Set()
      const edgeColor = '#94A3B8' // slate-400

      // Upward edges (child -> manager)
      for (const u of data) {
        const uid = String(u._id)
        const mid = resolveManagerId(u, byId)
        if (mid && mid !== uid) {
          const id = `${mid}->${uid}`
          if (!seen.has(id)) {
            seen.add(id)
            edges.push({
              id,
              source: mid,
              target: uid,
              type: 'smoothstep',
              markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 16, height: 16 },
              style: { stroke: edgeColor, strokeWidth: 2 },
            })
          }
        }
      }

      // Downward fallback (manager -> children) if no upward relation was found
      for (const u of data) {
        const uid = String(u._id)
        const kids = childArrays(u)
        if (!kids.length) continue
        for (const c of kids) {
          const cid = toId(c)
          if (!cid || !byId.has(cid) || cid === uid) continue
          const id = `${uid}->${cid}`
          if (seen.has(id)) continue
          seen.add(id)
          edges.push({
            id,
            source: uid,
            target: cid,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 16, height: 16 },
            style: { stroke: edgeColor, strokeWidth: 2 },
          })
        }
      }
    }

    return { nodes, edges }
  }, [data, showEdges, colorOf, onNodeClick])

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
        selectionOnDrag
        panOnScroll
        zoomOnScroll
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background gap={24} />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  )
}
