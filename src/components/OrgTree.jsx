import React, { useMemo, useCallback } from "react";
import ReactFlow, {
  Controls,
  Background,
  MarkerType,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";

export default function OrgTree({
  data = [],
  mode = "subtree",
  showEdges = true,
  onNodeClick,
}) {
  const X_GAP = 260;
  const Y_GAP = 160;
  const isVacant = (u) =>
    String(u?.status || "").trim().toLowerCase() === "vacant";

  const colorOf = useCallback((u) => {
    const seed =
      (u?.designation?.priority ?? 99) + (u?.designation?.name?.length ?? 0);
    const palette = ["#EEF2FF", "#ECFEFF", "#F0FDF4", "#FFF7ED", "#FDF2F8", "#F5F5F5"];
    const border  = ["#6366F1", "#06B6D4", "#22C55E", "#F59E0B", "#EC4899", "#6B7280"];
    const i = seed % palette.length;
    return { fill: palette[i], stroke: border[i] };
  }, []);

  const initials = (u) => {
    const src = u?.name || "";
    const [a = "", b = ""] = src.split(" ");
    return (a[0] || "").toUpperCase() + (b[0] || "").toUpperCase();
  };

  const PersonNode = ({ data, selected }) => {
    const u = data.user;
    const col = data.color;
    return (
      <div
        className={[
          "w-[240px] rounded-2xl bg-white border shadow-sm transition",
          "hover:shadow-md hover:-translate-y-[1px]",
          selected ? "ring-2 ring-brand-600" : "ring-1 ring-transparent",
          "border-gray-200",
        ].join(" ")}
        onClick={() => data.onClick?.(u)}
      >
        <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 0, height: 0 }} />
        <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 0, height: 0 }} />
        <div className="h-1 rounded-t-2xl" style={{ background: col?.stroke || "#6366F1" }} />
        <div className="p-3 flex items-center gap-3">
          <div
            className="size-10 shrink-0 rounded-xl flex items-center justify-center text-sm font-semibold"
            style={{
              background: col?.fill || "#EEF2FF",
              color: "#111827",
              border: `1px solid ${col?.stroke || "#6366F1"}`,
            }}
          >
            {initials(u) || "U"}
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold text-gray-900">{u?.name}</div>
            <div className="truncate text-xs text-gray-600">{u?.designation?.name || "—"}</div>
            <div className="truncate mt-0.5 text-[11px] text-gray-500">{u?.empId || u?.email}</div>
          </div>
        </div>
      </div>
    );
  };

  const VacantNode = ({ data }) => {
    const u = data.user;
    return (
      <div
        className={[
          "w-[240px] rounded-2xl bg-white border-2 border-dashed border-slate-300 text-slate-600 shadow-sm",
          "hover:shadow-md hover:-translate-y-[1px] cursor-default",
        ].join(" ")}
      >
        <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 0, height: 0 }} />
        <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 0, height: 0 }} />
        <div className="h-1 rounded-t-2xl bg-slate-200" />
        <div className="p-3 flex items-center gap-3">
          <div
            className="size-10 shrink-0 rounded-xl flex items-center justify-center text-base"
            style={{ background: "#F3F4F6", color: "#6B7280", border: "1px dashed #CBD5E1" }}
            aria-hidden="true"
            title="Vacant"
          >
            🪑
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold text-slate-800">Vacant Position</div>
            <div className="truncate text-xs text-slate-600">{u?.designation?.name || "—"}</div>
            <div className="truncate mt-0.5 text-[11px] text-slate-400">No employee assigned</div>
          </div>
        </div>
      </div>
    );
  };

  const nodeTypes = useMemo(() => ({ person: PersonNode, vacant: VacantNode }), []);

  // --- helpers ---
  const toId = (x) =>
    typeof x === "string" ? x : x && (x._id || x.id) ? String(x._id || x.id) : null;

  const resolveManagerId = (u, idSet) => {
    if (Array.isArray(u?.reportingTo) && u.reportingTo.length) {
      for (const m of u.reportingTo) {
        const id = toId(m);
        if (id && idSet.has(id)) return id;
      }
    }
    const candidates = [u?.reportingToId, u?.managerId, u?.manager];
    for (const c of candidates) {
      const id = toId(c);
      if (id && idSet.has(id)) return id;
    }
    return null;
  };

  const { nodes, edges } = useMemo(() => {
    const nodes = [];
    const edges = [];
    if (!Array.isArray(data) || data.length === 0) return { nodes, edges };

    const byId = new Map(data.map((u) => [String(u._id), u]));
    const ids = data.map((u) => String(u._id));
    const idSet = new Set(ids);

    // uid -> mid ; mid -> [uid...]
    const managerOf = new Map();
    const childrenOf = new Map();
    for (const u of data) {
      const uid = String(u._id);
      const mid = resolveManagerId(u, idSet);
      if (mid) {
        managerOf.set(uid, mid);
        if (!childrenOf.has(mid)) childrenOf.set(mid, []);
        childrenOf.get(mid).push(uid);
      }
    }

    // roots: no manager in this dataset
    const roots = ids.filter((uid) => !managerOf.has(uid));

    // BFS depth purely by manager->children
    const depthOf = new Map();
    const visited = new Set();
    const q = [];

    for (const r of roots) {
      depthOf.set(r, 0);
      visited.add(r);
      q.push(r);
    }
    while (q.length) {
      const cur = q.shift();
      const d = depthOf.get(cur) || 0;
      for (const child of childrenOf.get(cur) || []) {
        if (!visited.has(child)) {
          visited.add(child);
          depthOf.set(child, d + 1);
          q.push(child);
        }
      }
    }
    // orphans/cycles → still render
    for (const uid of ids) if (!depthOf.has(uid)) depthOf.set(uid, 0);

    // group by depth, sort rows for stable layout
    const groups = new Map();
    for (const uid of ids) {
      const d = depthOf.get(uid) ?? 0;
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d).push(byId.get(uid));
    }
    for (const [d, arr] of groups) {
      arr.sort((a, b) =>
        String(a?.name || "").localeCompare(String(b?.name || ""))
      );
    }

    const maxDepth = Math.max(...groups.keys());
    const maxRow = Math.max(...Array.from(groups.values()).map((arr) => arr.length || 0), 1);

    // layout
    for (let depth = 0; depth <= maxDepth; depth++) {
      const row = groups.get(depth) || [];
      if (!row.length) continue;
      const rowWidth = (row.length - 1) * X_GAP;
      const maxWidth = (maxRow - 1) * X_GAP;
      const offsetX = (maxWidth - rowWidth) / 2;

      row.forEach((u, idx) => {
        const { fill, stroke } = colorOf(u);
        const vacant = isVacant(u);
        nodes.push({
          id: String(u._id),
          type: vacant ? "vacant" : "person",
          position: { x: offsetX + idx * X_GAP, y: depth * Y_GAP },
          sourcePosition: "bottom",
          targetPosition: "top",
          data: { user: u, color: { fill, stroke }, onClick: vacant ? undefined : onNodeClick },
        });
      });
    }

    if (showEdges) {
      const seen = new Set();
      const edgeColor = "#B1B1B1";
      const pushEdge = (src, tgt) => {
        if (!src || !tgt || src === tgt) return;
        const id = `${src}->${tgt}`;
        if (seen.has(id)) return;
        seen.add(id);
        edges.push({
          id,
          source: src,
          target: tgt,
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 16, height: 16 },
          style: { stroke: edgeColor, strokeWidth: 2 },
        });
      };
      for (const [uid, mid] of managerOf) pushEdge(mid, uid);
    }

    return { nodes, edges };
  }, [data, showEdges, colorOf, onNodeClick]);

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
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background gap={24} />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  );
}
