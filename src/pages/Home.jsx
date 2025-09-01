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
        <td key={i} className="px-4 py-3">
          <div className="h-3 w-full max-w-[120px] animate-pulse rounded bg-gray-200" />
        </td>
      ))}
    </tr>
  );
}

// Soft color palette per status
function statusPillClasses(status) {
  const s = String(status || "unknown").toLowerCase().replace(/\s+/g, "_");
  const map = {
    active: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    on_leave: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
    leave: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
    probation: "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
    trainee: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100",
    contract: "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-100",
    inactive: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
    resigned: "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
    terminated: "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
    retired: "bg-stone-50 text-stone-700 ring-1 ring-stone-100",
    unknown: "bg-gray-100 text-gray-700 ring-1 ring-gray-200",
  };
  return map[s] || "bg-gray-100 text-gray-700 ring-1 ring-gray-200";
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
                    // inline refresh, same logic as effect
                    (async () => {
                      try {
                        setDeptRows([]);
                        setDeptError("");
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

            {/* Fancy Table */}
            <div className="card overflow-x-auto p-0 shadow-sm">
              <style>{`
                .sticky-th { position: sticky; top: 0; z-index: 20; }
                .sticky-td { position: sticky; left: 0; z-index: 10; background: white; }
                .table-head-grad {
                  background: linear-gradient(180deg, rgba(248,250,252,0.95) 0%, rgba(241,245,249,0.95) 100%);
                  backdrop-filter: blur(2px);
                  box-shadow: 0 1px 0 0 rgba(0,0,0,0.06), 0 2px 6px -2px rgba(0,0,0,0.05);
                }
                    /* NEW: horizontal scroll container tweaks */
    .scroll-x {
      overflow-x: auto;
      overscroll-behavior-x: contain;
      -webkit-overflow-scrolling: touch; /* iOS momentum */
      scrollbar-gutter: stable both-edges; /* keeps layout stable when showing scrollbar */
      touch-action: pan-x; /* improves horizontal scroll on mobile */
    }
                .table-wrap { border-radius: 0.75rem; overflow: hidden; border: 1px solid #e5e7eb; }
                @media (max-width: 640px) {
                  .sticky-td { min-width: 200px; }
                }
              `}</style>

              <div className="table-wrap -mx-4 sm:mx-0">
                 <div className="scroll-x px-4 sm:px-0">
                  {deptLoading ? (
                  <table className="table min-w-max">
                    <thead className="table-head-grad">
                      <tr>
                        <th className="sticky-th px-4 py-3 text-left text-sm font-semibold text-slate-700">Department</th>
                        <th className="sticky-th px-4 py-3 text-right text-sm font-semibold text-slate-700">Total</th>
                        <th className="sticky-th px-4 py-3 text-right text-sm font-semibold text-slate-700">Status A</th>
                        <th className="sticky-th px-4 py-3 text-right text-sm font-semibold text-slate-700">Status B</th>
                        <th className="sticky-th px-4 py-3 text-right text-sm font-semibold text-slate-700">Status C</th>
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
                  <table className="table w-full">
                    <thead className="table-head-grad">
                      <tr>
                        <th className="sticky-th px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-slate-700">
                          Department
                        </th>
                        <th className="sticky-th px-4 py-3 text-right text-sm font-semibold uppercase tracking-wide text-slate-700">
                          Total
                        </th>
                        {allStatuses.map((s) => (
                          <th
                            key={s}
                            className="sticky-th px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600"
                            title={s}
                          >
                            {s}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {deptRows.map((r, idx) => (
                        <tr
                          key={r._id}
                          className={idx % 2 ? "bg-white hover:bg-slate-50" : "bg-slate-50/60 hover:bg-slate-50"}
                        >
                          <td className=" px-4 py-3 text-slate-800 font-medium">
                            {r.name}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-sm font-semibold text-slate-800 ring-1 ring-slate-200">
                              {fmt(r.total)}
                            </span>
                          </td>
                          {allStatuses.map((s) => {
                            const val = r.byStatus?.[s] ?? 0;
                            const pill = statusPillClasses(s);
                            return (
                              <td key={s} className="px-3 py-3 text-right">
                                <span className={`inline-flex items-center justify-end rounded-full px-2 py-0.5 text-xs font-semibold ${pill}`}>
                                  {fmt(val)}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>

                    {deptRows.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-100/70">
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            All Departments
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">
                              {fmt(grandTotals.total)}
                            </span>
                          </td>
                          {allStatuses.map((s) => {
                            const val = grandTotals.byStatus[s] ?? 0;
                            const pill = statusPillClasses(s);
                            return (
                              <td key={s} className="px-3 py-3 text-right">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${pill}`}>
                                  {fmt(val)}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                )}
                 </div>
              </div>
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
