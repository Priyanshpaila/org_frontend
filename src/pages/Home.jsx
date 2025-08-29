import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar.jsx";
import SearchBar from "../components/SearchBar.jsx";
import UserDetailsTable from "../components/UserDetailsTable.jsx";
import OrgTree from "../components/OrgTree.jsx";
import api from "../lib/api.js";

const MIN_CHARS = 2;
const PAGE_SIZE = 200; // users per page while counting statuses

// ---------- small helpers ----------
const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString() : "0");

function downloadCSV(filename, rows) {
  const csv = rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- skeleton row ----------
function SkeletonRow({ cols = 5 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-2">
          <div className="h-3 w-full max-w-[120px] animate-pulse rounded bg-gray-200" />
        </td>
      ))}
    </tr>
  );
}

export default function Home() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);

  const [subtree, setSubtree] = useState([]);
  const [roots, setRoots] = useState([]);
  const [mainTree, setMainTree] = useState([]);

  // ---- Department summary state ----
  const [deptLoading, setDeptLoading] = useState(false);
  const [deptError, setDeptError] = useState("");
  // rows: [{ _id, name, total, byStatus: { [status]: count } }]
  const [deptRows, setDeptRows] = useState([]);

  // ---------- search ----------
  const runSearch = async (queryFromBar) => {
    const raw = queryFromBar ?? q;
    const query = raw.trim();
    setHasSearched(true);

    if (!query) {
      setResults([]);
      setSelected(null);
      setSubtree([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data } = await api.get("/users", { params: { q: query, limit: 10 } });
      const items = data.items || [];
      setResults(items);
      setSelected(items[0] || null);
    } catch (e) {
      console.error(e);
      setResults([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  };

  const loadSubtree = async (id) => {
    if (!id) return;
    try {
      const { data } = await api.get(`/users/${id}/subtree`, { params: { depth: 3 } });
      setSubtree(data || []);
    } catch (e) {
      console.error(e);
      setSubtree([]);
    }
  };

  const handleNodeClick = (u) => {
    if (!u || !u._id) return;
    setSelected(u);
    const token = u.name || u.empId || u.email || "";
    setQ(token);
    setHasSearched(false);
    loadSubtree(u._id);
    setResults((prev) => {
      if (Array.isArray(prev) && prev.find((x) => x._id === u._id)) return prev;
      return [u, ...prev];
    });
  };

  // ---------- main org forest ----------
  useEffect(() => {
    let mounted = true;
    api
      .get("/users/roots", { params: { full: 1, depth: 6 } })
      .then(({ data }) => {
        if (!mounted) return;
        if (Array.isArray(data)) {
          setRoots(data);
          setMainTree(data);
        } else {
          setRoots(data.roots || []);
          setMainTree(data.tree || data.roots || []);
        }
      })
      .catch((err) => {
        console.error(err);
        if (!mounted) return;
        setRoots([]);
        setMainTree([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (selected && selected._id) loadSubtree(selected._id);
  }, [selected]);

  const clearSearch = () => {
    setQ("");
    setResults([]);
    setSelected(null);
    setSubtree([]);
    setHasSearched(false);
  };

  const typingButNotReady = q.trim().length > 0 && q.trim().length < MIN_CHARS;
  const showNoResults =
    hasSearched && !loading && q.trim().length >= MIN_CHARS && results.length === 0;

  // ---------- Department Summary Loader (no-search view only) ----------
  useEffect(() => {
    if (q) return; // don’t load while in search mode
    let abort = false;

    async function fetchDeptSummary() {
      try {
        setDeptError("");
        setDeptLoading(true);

        // 1) Departments
        const { data: departments } = await api.get("/meta/departments");
        const depts = Array.isArray(departments)
          ? departments
          : departments.items || [];

        // 2) For each department, page through users and count statuses
        const result = [];
        for (const d of depts) {
          if (abort) return;

          const depId = d._id || d.id;
          const depName = d.name || "—";
          const byStatus = {};
          let total = 0;

          // first page to learn grand total
          const firstResp = await api.get("/users", {
            params: { department: depId, page: 1, limit: PAGE_SIZE },
          });
          const firstItems = firstResp.data?.items || [];
          const grandTotal =
            Number(firstResp.data?.total) || firstItems.length;

          const consume = (arr) => {
            for (const u of arr) {
              const s = String(u?.status || "unknown");
              byStatus[s] = (byStatus[s] || 0) + 1;
              total++;
            }
          };

          consume(firstItems);

          const totalPages = Math.max(1, Math.ceil(grandTotal / PAGE_SIZE));
          for (let p = 2; p <= totalPages; p++) {
            if (abort) return;
            const { data } = await api.get("/users", {
              params: { department: depId, page: p, limit: PAGE_SIZE },
            });
            consume(data?.items || []);
          }

          result.push({ _id: depId, name: depName, total, byStatus });
        }

        if (!abort) setDeptRows(result);
      } catch (err) {
        console.error(err);
        if (!abort) setDeptError("Failed to load department summary.");
      } finally {
        if (!abort) setDeptLoading(false);
      }
    }

    fetchDeptSummary();
    return () => {
      abort = true;
    };
  }, [q]);

  // Dynamic status columns
  const allStatuses = useMemo(() => {
    const s = new Set();
    for (const r of deptRows) {
      Object.keys(r.byStatus || {}).forEach((k) => s.add(k));
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [deptRows]);

  // Grand totals
  const grandTotals = useMemo(() => {
    const totals = { total: 0, byStatus: {} };
    for (const r of deptRows) {
      totals.total += r.total || 0;
      for (const s of allStatuses) {
        totals.byStatus[s] = (totals.byStatus[s] || 0) + (r.byStatus?.[s] || 0);
      }
    }
    return totals;
  }, [deptRows, allStatuses]);

  const exportDeptCSV = () => {
    const header = ["Department", "Total", ...allStatuses];
    const rows = [header];

    for (const r of deptRows) {
      rows.push([
        r.name,
        r.total,
        ...allStatuses.map((s) => r.byStatus?.[s] ?? 0),
      ]);
    }

    rows.push([
      "All Departments",
      grandTotals.total,
      ...allStatuses.map((s) => grandTotals.byStatus[s] ?? 0),
    ]);

    downloadCSV("department_status_summary.csv", rows);
  };

  return (
    <div className="min-h-full bg-gray-50">
      <Navbar />
      <div className="page">
        {/* search bar row */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchBar
            value={q}
            onChange={setQ}
            onSubmit={runSearch}
            onClear={clearSearch}
            isLoading={loading}
            allowEmptySubmit
            minChars={MIN_CHARS}
            debounceMs={400}
            caseInsensitive
          />

          {results?.length > 0 && (
            <select
              className="select w-60"
              value={selected?._id || ""}
              onChange={(e) =>
                setSelected(results.find((r) => r._id === e.target.value))
              }
            >
              {results.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name} ({r.empId || r.email})
                </option>
              ))}
            </select>
          )}

          {(q.length > 0 || results.length > 0) && (
            <button className="btn btn-ghost" onClick={clearSearch}>
              Clear
            </button>
          )}
        </div>

        {/* No search → show main tree + department summary */}
        {!q && (
          <>
            <div className="mb-3 text-lg font-semibold">Main Org Tree</div>
            <OrgTree data={mainTree} mode="subtree" onNodeClick={handleNodeClick} />

            {/* Department Summary */}
            <div className="mt-6 mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-lg font-semibold">Department Summary</div>
              <div className="flex gap-2">
                <button
                  className="btn btn-sm bg-slate-600 text-white hover:bg-slate-700"
                  onClick={() => {
                    // force reload (only in no-search state)
                    setDeptRows([]);
                    setDeptError("");
                    // toggle q twice to re-trigger effect without disturbing view
                    // or simpler: set q to same string won't retrigger — so call the loader path by flipping a dummy state
                    // instead we call the same fetch by toggling local state:
                    // easiest is to just set deptLoading and refire effect via minor state:
                    // but we’ll simply re-run the effect by briefly setting q to "_" and back to "".
                    // Safer: just run the loader inline:
                    (async () => {
                      // mimic the effect logic quickly
                      try {
                        setDeptLoading(true);
                        const { data: departments } = await api.get("/meta/departments");
                        const depts = Array.isArray(departments)
                          ? departments
                          : departments.items || [];
                        const result = [];
                        for (const d of depts) {
                          const depId = d._id || d.id;
                          const depName = d.name || "—";
                          const byStatus = {};
                          let total = 0;

                          const firstResp = await api.get("/users", {
                            params: { department: depId, page: 1, limit: PAGE_SIZE },
                          });
                          const firstItems = firstResp.data?.items || [];
                          const grandTotal =
                            Number(firstResp.data?.total) || firstItems.length;

                          const consume = (arr) => {
                            for (const u of arr) {
                              const s = String(u?.status || "unknown");
                              byStatus[s] = (byStatus[s] || 0) + 1;
                              total++;
                            }
                          };

                          consume(firstItems);

                          const totalPages = Math.max(
                            1,
                            Math.ceil(grandTotal / PAGE_SIZE)
                          );
                          for (let p = 2; p <= totalPages; p++) {
                            const { data } = await api.get("/users", {
                              params: { department: depId, page: p, limit: PAGE_SIZE },
                            });
                            consume(data?.items || []);
                          }

                          result.push({ _id: depId, name: depName, total, byStatus });
                        }
                        setDeptRows(result);
                      } catch (e) {
                        console.error(e);
                        setDeptError("Failed to refresh department summary.");
                      } finally {
                        setDeptLoading(false);
                      }
                    })();
                  }}
                  disabled={deptLoading}
                >
                  Refresh
                </button>
                <button
                  className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={exportDeptCSV}
                  disabled={deptLoading || deptRows.length === 0}
                  title="Export to Excel"
                >
                  Export Excel (.csv)
                </button>
              </div>
            </div>

            <div className="card p-0 overflow-x-auto">
              {/* sticky header & first column helpers */}
              <style>{`
                .sticky-th { position: sticky; top: 0; z-index: 10; }
                .sticky-td { position: sticky; left: 0; z-index: 5; background: white; }
                @media (max-width: 640px) {
                  .sticky-td { min-width: 180px; }
                }
              `}</style>

              {deptLoading ? (
                <table className="table w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="sticky-th px-4 py-2 text-left">Department</th>
                      <th className="sticky-th px-4 py-2 text-right">Total</th>
                      <th className="sticky-th px-4 py-2 text-right">Status A</th>
                      <th className="sticky-th px-4 py-2 text-right">Status B</th>
                      <th className="sticky-th px-4 py-2 text-right">Status C</th>
                    </tr>
                  </thead>
                  <tbody>
                    <SkeletonRow cols={5} />
                    <SkeletonRow cols={5} />
                    <SkeletonRow cols={5} />
                  </tbody>
                </table>
              ) : deptError ? (
                <div className="p-4 text-sm text-red-600">{deptError}</div>
              ) : (
                <table className="table table-zebra w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="sticky-th px-4 py-2 text-left">Department</th>
                      <th className="sticky-th px-4 py-2 text-right">Total</th>
                      {allStatuses.map((s) => (
                        <th key={s} className="sticky-th px-4 py-2 text-right">
                          {s}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {deptRows.map((r) => (
                      <tr key={r._id}>
                        <td className="sticky-td px-4 py-2 font-medium">{r.name}</td>
                        <td className="px-4 py-2 text-right">{fmt(r.total)}</td>
                        {allStatuses.map((s) => (
                          <td key={s} className="px-4 py-2 text-right">
                            {fmt(r.byStatus?.[s] ?? 0)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  {deptRows.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-50">
                        <td className="sticky-td px-4 py-2 font-semibold">
                          All Departments
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">
                          {fmt(grandTotals.total)}
                        </td>
                        {allStatuses.map((s) => (
                          <td key={s} className="px-4 py-2 text-right font-semibold">
                            {fmt(grandTotals.byStatus[s] ?? 0)}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </div>
          </>
        )}

        {/* Search mode */}
        {q && (
          <>
            {loading && (
              <div className="card p-4 text-sm text-gray-700">Searching…</div>
            )}

            {!loading && typingButNotReady && (
              <div className="card p-4 text-sm text-gray-700">
                Type at least {MIN_CHARS} characters to search.
              </div>
            )}

            {!loading && showNoResults && (
              <div className="card p-4 text-sm text-gray-700">
                No results for “{q}”. Try another name, email, or employee ID.
              </div>
            )}

            {!loading && selected && (
              <>
                <UserDetailsTable user={selected} />
                <div className="mt-4 mb-2 text-lg font-semibold">
                  Hierarchy around {selected.name}
                </div>
                <OrgTree data={subtree} mode="subtree" onNodeClick={handleNodeClick} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
