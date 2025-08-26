import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar.jsx";
import SearchBar from "../components/SearchBar.jsx";
import RoleBadge from "../components/RoleBadge.jsx";
import api from "../lib/api.js";
import { useAuthStore } from "../store/authStore.js";

const STATUS_OPTIONS = ["active", "inactive", "vacant", "on_leave"];

export default function Users() {
  const token = useAuthStore((s) => s.accessToken);
  const { isAdmin, isSuperAdmin, user: me } = useAuthStore();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);

  // meta (for selects)
  const [meta, setMeta] = useState({
    departments: [],
    divisions: [],
    designations: [],
  });
  const [loadingMeta, setLoadingMeta] = useState(true);

  // modal state
  const [showModal, setShowModal] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [activeUser, setActiveUser] = useState(null);

  // edit state (everything editable)
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);

  // manager search (for Reporting To)
  const [mgrQ, setMgrQ] = useState("");
  const [mgrResults, setMgrResults] = useState([]);
  const [mgrLoading, setMgrLoading] = useState(false);

  const [working, setWorking] = useState(false);
  const canHardDelete = isSuperAdmin?.() === true;
  const canSoftDelete = isAdmin?.() === true || canHardDelete;

  const [banner, setBanner] = useState(null);
  const toast = (msg) => {
    setBanner(msg);
    clearTimeout(toast._t);
    toast._t = setTimeout(() => setBanner(null), 2500);
  };

  // --------- Load meta once ----------
  useEffect(() => {
    if (!token) return;
    let mounted = true;
    Promise.all([
      api.get("/meta/departments"),
      api.get("/meta/divisions"),
      api.get("/meta/designations"),
    ])
      .then(([d, v, g]) => {
        if (!mounted) return;
        const designations = (g.data || [])
          .slice()
          .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
        setMeta({
          departments: d.data || [],
          divisions: v.data || [],
          designations,
        });
      })
      .finally(() => setLoadingMeta(false));
    return () => {
      mounted = false;
    };
  }, [token]);

  // --------- Lock body scroll when modal open ----------
  useEffect(() => {
    if (!showModal) return;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtml || "";
      document.body.style.overflow = prevBody || "";
    };
  }, [showModal]);

  // --------- List loader ----------
  const loadUsers = async (query = "") => {
    try {
      setLoading(true);
      const params = { limit: 200 };
      if (query?.trim()) params.q = query.trim();
      const { data } = await api.get("/users", { params });
      setUsers(data.items || []);
    } catch (e) {
      setUsers([]);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!token) return;
    loadUsers("");
  }, [token]);

  const runSearch = async (normQ) => {
    const query = typeof normQ === "string" ? normQ : q.trim();
    if (!query) return loadUsers("");
    return loadUsers(query);
  };

  // --------- Open user + prepare edit state ----------
  const openUser = async (id) => {
    setActiveId(id);
    setShowModal(true);
    try {
      const { data } = await api.get(`/users/${id}`);
      setActiveUser(data);
      setEdit({
        name: data?.name || "",
        email: data?.email || "",
        empId: data?.empId || "",
        role: data?.role || "user",
        status: data?.status || "active",
        department: data?.department?._id || "",
        division: data?.division?._id || "",
        designation: data?.designation?._id || "",
        dateOfJoining: data?.dateOfJoining
          ? data.dateOfJoining.slice(0, 10)
          : "",
        reportingTo: (data?.reportingTo || []).map((r) => r._id),
        // optional admin reset (exactly 8 chars)
        newPassword: "",
      });
      setMgrQ("");
      setMgrResults([]);
    } catch (e) {
      setShowModal(false);
      setActiveId(null);
      setActiveUser(null);
      toast(e.response?.data?.error || "Failed to load user");
    }
  };
  const closeModal = () => {
    setShowModal(false);
    setActiveId(null);
    setActiveUser(null);
    setEdit(null);
  };

  // --------- Manager search ----------
  const searchManagers = async () => {
    const query = mgrQ.trim();
    if (query.length < 2) {
      setMgrResults([]);
      return;
    }
    try {
      setMgrLoading(true);
      const { data } = await api.get("/users", {
        params: { q: query, limit: 10 },
      });
      // exclude the user themself & duplicates
      const items = (data.items || []).filter(
        (u) =>
          String(u._id) !== String(activeId) &&
          !(edit?.reportingTo || []).includes(u._id)
      );
      setMgrResults(items);
    } catch (e) {
      setMgrResults([]);
    } finally {
      setMgrLoading(false);
    }
  };
  const addManager = (u) => {
    setEdit((ed) => ({
      ...ed,
      reportingTo: Array.from(new Set([...(ed.reportingTo || []), u._id])),
    }));
  };
  const removeManager = (id) => {
    setEdit((ed) => ({
      ...ed,
      reportingTo: (ed.reportingTo || []).filter((x) => x !== id),
    }));
  };

  // --------- Save edits ----------
  const saveEdits = async () => {
    if (!activeUser?._id || !edit) return;
    try {
      setSaving(true);

      // compute diffs
      const diffs = {};
      const base = activeUser;
      if (edit.name !== (base.name || "")) diffs.name = edit.name;
      if (edit.email !== (base.email || "")) diffs.email = edit.email;
      if ((edit.empId || "") !== (base.empId || ""))
        diffs.empId = edit.empId || "";
      if ((edit.status || "active") !== (base.status || "active"))
        diffs.status = edit.status || "active";
      const depId = base.department?._id || "";
      const divId = base.division?._id || "";
      const desId = base.designation?._id || "";
      if ((edit.department || "") !== depId)
        diffs.department = edit.department || "";
      if ((edit.division || "") !== divId) diffs.division = edit.division || "";
      if ((edit.designation || "") !== desId)
        diffs.designation = edit.designation || "";
      const doj = base.dateOfJoining ? base.dateOfJoining.slice(0, 10) : "";
      if ((edit.dateOfJoining || "") !== (doj || ""))
        diffs.dateOfJoining = edit.dateOfJoining || "";
      const repIds = (base.reportingTo || []).map((r) => r._id);
      if (JSON.stringify(repIds) !== JSON.stringify(edit.reportingTo || []))
        diffs.reportingTo = edit.reportingTo || [];

      // role change (some backends use a dedicated endpoint)
      if ((edit.role || "user") !== (base.role || "user")) {
        await api.patch(`/users/${activeUser._id}/role`, { role: edit.role });
      }

      // general patch only if something changed
      if (Object.keys(diffs).length > 0) {
        await api.patch(`/users/${activeUser._id}`, diffs);
      }

      // optional admin reset password (exactly 8 chars)
      if (edit.newPassword && edit.newPassword.length === 8) {
        try {
          // try explicit password endpoint first
          await api.post(`/users/${activeUser._id}/password`, {
            newPassword: edit.newPassword,
          });
        } catch {
          // fallback: some backends accept patch with password
          await api.patch(`/users/${activeUser._id}`, {
            password: edit.newPassword,
          });
        }
      }

      toast("Changes saved");
      await loadUsers(q);
      const { data } = await api.get(`/users/${activeUser._id}`);
      setActiveUser(data);
      setEdit((ed) => ({ ...(ed || {}), newPassword: "" })); // clear
    } catch (e) {
      toast(e.response?.data?.error || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  // --------- Delete actions ----------
  const softDelete = async () => {
    if (!canSoftDelete || !activeUser?._id) return;
    if (!confirm(`Soft delete ${activeUser.name}?`)) return;
    try {
      setWorking(true);
      await api.patch(`/users/${activeUser._id}`, { isDeleted: true });
      toast("User soft-deleted");
      await loadUsers(q);
      const { data } = await api.get(`/users/${activeUser._id}`);
      setActiveUser(data);
    } catch (e) {
      toast(e.response?.data?.error || "Failed to soft delete");
    } finally {
      setWorking(false);
    }
  };

  const restore = async () => {
    if (!activeUser?._id) return;
    try {
      setWorking(true);
      await api.patch(`/users/${activeUser._id}`, { isDeleted: false });
      toast("User restored");
      await loadUsers(q);
      const { data } = await api.get(`/users/${activeUser._id}`);
      setActiveUser(data);
    } catch (e) {
      toast(e.response?.data?.error || "Failed to restore");
    } finally {
      setWorking(false);
    }
  };

  const hardDelete = async () => {
    if (!canHardDelete || !activeUser?._id) return;
    if (activeUser.role === "superadmin")
      return toast("Cannot delete a superadmin");
    if (activeUser._id === me?._id)
      return toast("You cannot delete your own account");
    if (
      !confirm(`Permanently delete ${activeUser.name}? This cannot be undone.`)
    )
      return;
    try {
      setWorking(true);
      await api.delete(`/users/${activeUser._id}`);
      toast("User permanently deleted");
      closeModal();
      loadUsers(q);
    } catch (e) {
      toast(e.response?.data?.error || "Failed to hard delete");
    } finally {
      setWorking(false);
    }
  };

  /* ---------- UI helpers ---------- */
  const fmt = (d) => (d ? new Date(d).toLocaleDateString() : "—");
  const filteredCount = useMemo(() => users.length, [users]);

  return (
    <div className="min-h-full bg-gray-50">
      <Navbar />

      <div className="page">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Users</div>
            <div className="text-xs text-gray-500">
              {filteredCount} result{filteredCount === 1 ? "" : "s"}
            </div>
          </div>
          <SearchBar
            value={q}
            onChange={setQ}
            onSubmit={runSearch}
            onClear={() => {
              setQ("");
              loadUsers("");
            }}
            isLoading={loading}
            allowEmptySubmit
            minChars={2}
            debounceMs={400}
            caseInsensitive
          />
        </div>

        {banner && (
          <div className="mb-3 rounded-xl bg-amber-50 border border-amber-200 p-2 text-sm text-amber-800">
            {banner}
          </div>
        )}

        {/* Mobile: cards */}
        <div className="md:hidden space-y-2">
          {users.map((u) => (
            <button
              key={u._id}
              onClick={() => openUser(u._id)}
              className="w-full rounded-2xl border border-gray-200 bg-white p-3 text-left shadow-sm hover:shadow transition"
              title="View & edit"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium truncate">{u.name}</div>
                <RoleBadge role={u.role} />
              </div>
              <div className="text-xs text-gray-600 break-all">{u.email}</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="badge">{u.status || "active"}</span>
                {u.isDeleted && (
                  <span className="badge bg-rose-50 text-rose-700 border border-rose-200">
                    soft-deleted
                  </span>
                )}
              </div>
            </button>
          ))}
          {users.length === 0 && !loading && (
            <div className="card p-4 text-sm text-gray-600">
              No users found.
            </div>
          )}
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block">
          <div className="card p-4">
            <div className="overflow-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="p-2">Name</th>
                    <th className="p-2">Email</th>
                    <th className="p-2">Role</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id} className="border-t">
                      <td className="p-2">
                        <button
                          className="max-w-[280px] truncate underline underline-offset-2 hover:text-blue-700"
                          onClick={() => openUser(u._id)}
                          title="View & edit"
                        >
                          {u.name}
                        </button>
                      </td>
                      <td className="p-2 break-all">{u.email}</td>
                      <td className="p-2">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="p-2">
                        <span className="badge">{u.status || "active"}</span>
                      </td>
                      <td className="p-2">
                        {u.isDeleted && (
                          <span className="badge bg-rose-50 text-rose-700 border border-rose-200">
                            soft-deleted
                          </span>
                        )}
                      </td>
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

      {/* -------- Modal: User details + full edit -------- */}
      {showModal && (
        <div className="fixed inset-0 z-50 grid place-items-center p-3 sm:p-6">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div
            role="dialog"
            aria-modal="true"
            className="
              relative z-10 w-full max-w-[48rem] md:max-w-[60rem]
              max-h-[calc(100svh-1.5rem)] sm:max-h-[calc(100svh-3rem)]
              overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl
            "
          >
            {!activeUser || !edit ? (
              <div className="p-6 text-sm text-gray-600">Loading…</div>
            ) : (
              <>
                {/* Header */}
                <div className="mb-4 flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-xl font-semibold truncate">
                        {activeUser.name}
                      </div>
                      {activeUser.isDeleted && (
                        <span className="badge bg-rose-50 text-rose-700 border border-rose-200">
                          soft-deleted
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 break-all">
                      {activeUser.empId ? `${activeUser.empId} • ` : ""}
                      {activeUser.email}
                    </div>
                  </div>
                  <button className="btn btn-ghost" onClick={closeModal}>
                    ✕
                  </button>
                </div>

                {/* Editable form */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Full Name">
                    <input
                      className="input"
                      value={edit.name}
                      onChange={(e) =>
                        setEdit((v) => ({ ...v, name: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      className="input"
                      type="email"
                      value={edit.email}
                      onChange={(e) =>
                        setEdit((v) => ({ ...v, email: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Employee ID">
                    <input
                      className="input"
                      value={edit.empId}
                      onChange={(e) =>
                        setEdit((v) => ({ ...v, empId: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Date of Joining">
                    <input
                      className="input"
                      type="date"
                      value={edit.dateOfJoining || ""}
                      onChange={(e) =>
                        setEdit((v) => ({
                          ...v,
                          dateOfJoining: e.target.value,
                        }))
                      }
                    />
                  </Field>

                  <Field label="Role">
                    <select
                      className="select"
                      value={edit.role}
                      onChange={(e) =>
                        setEdit((v) => ({ ...v, role: e.target.value }))
                      }
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                      <option value="superadmin">superadmin</option>
                    </select>
                  </Field>

                  <Field label="Status">
                    <select
                      className="select"
                      value={edit.status}
                      onChange={(e) =>
                        setEdit((v) => ({ ...v, status: e.target.value }))
                      }
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Department">
                    <select
                      className="select"
                      value={edit.department}
                      onChange={(e) =>
                        setEdit((v) => ({ ...v, department: e.target.value }))
                      }
                      disabled={loadingMeta}
                    >
                      <option value="">
                        {loadingMeta ? "Loading…" : "— Select —"}
                      </option>
                      {meta.departments.map((o) => (
                        <option key={o._id} value={o._id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Division">
                    <select
                      className="select"
                      value={edit.division}
                      onChange={(e) =>
                        setEdit((v) => ({ ...v, division: e.target.value }))
                      }
                      disabled={loadingMeta}
                    >
                      <option value="">
                        {loadingMeta ? "Loading…" : "— Select —"}
                      </option>
                      {meta.divisions.map((o) => (
                        <option key={o._id} value={o._id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Designation">
                    <select
                      className="select"
                      value={edit.designation}
                      onChange={(e) =>
                        setEdit((v) => ({ ...v, designation: e.target.value }))
                      }
                      disabled={loadingMeta}
                    >
                      <option value="">
                        {loadingMeta ? "Loading…" : "— Select —"}
                      </option>
                      {meta.designations.map((o) => (
                        <option key={o._id} value={o._id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {/* Optional password reset (exactly 8) */}
                  <Field label="Reset Password (exactly 8 chars)">
                    <div className="relative">
                      <input
                        className="input pr-12"
                        type="password"
                        value={edit.newPassword}
                        onChange={(e) => {
                          const v = e.target.value.slice(0, 8);
                          setEdit((x) => ({ ...x, newPassword: v }));
                        }}
                        placeholder="leave blank to skip"
                        minLength={0}
                        maxLength={8}
                        autoComplete="new-password"
                      />
                      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-gray-500">
                        {edit.newPassword.length}/8
                      </div>
                    </div>
                  </Field>

                  {/* Reporting To */}
                  <div className="md:col-span-2">
                    <div className="mb-1 text-sm font-medium text-gray-700">
                      Reporting To (multi)
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        className="input"
                        placeholder="Search managers by name/email/ID…"
                        value={mgrQ}
                        onChange={(e) => setMgrQ(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            searchManagers();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost w-full sm:w-auto"
                        onClick={searchManagers}
                        disabled={mgrLoading}
                      >
                        {mgrLoading ? "Searching…" : "Search"}
                      </button>
                    </div>

                    <div className="mt-2 min-h-[44px]">
                      {mgrQ.trim().length > 0 &&
                        mgrResults.length === 0 &&
                        !mgrLoading && (
                          <div className="text-sm text-gray-500">
                            No matches. Try another name or email.
                          </div>
                        )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {mgrResults.map((u) => (
                          <button
                            type="button"
                            key={u._id}
                            className="badge border-gray-300 hover:bg-gray-100"
                            onClick={() => addManager(u)}
                            title="Add as manager"
                          >
                            + {u.name} {u.empId ? `(${u.empId})` : ""}
                          </button>
                        ))}
                      </div>
                    </div>

                    {(edit.reportingTo || []).length > 0 && (
                      <div className="mt-3">
                        <div className="mb-1 text-xs font-medium text-gray-600">
                          Selected managers ({edit.reportingTo.length})
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(activeUser.reportingTo || [])
                            .filter((r) =>
                              (edit.reportingTo || []).includes(r._id)
                            )
                            .map((r) => (
                              <span
                                key={r._id}
                                className="badge border-gray-300"
                              >
                                {r.name}
                                {r.empId ? ` (${r.empId})` : ""}
                                <button
                                  type="button"
                                  className="ml-1 rounded px-1 text-gray-500 hover:bg-gray-100"
                                  onClick={() => removeManager(r._id)}
                                  title="Remove"
                                >
                                  ✕
                                </button>
                              </span>
                            ))}

                          {/* For newly added managers not present in original list, show IDs until modal refresh */}
                          {(edit.reportingTo || [])
                            .filter(
                              (id) =>
                                !(activeUser.reportingTo || []).some(
                                  (r) => r._id === id
                                )
                            )
                            .map((id) => (
                              <span key={id} className="badge border-gray-300">
                                {id.slice(0, 4)}…{id.slice(-3)}
                                <button
                                  type="button"
                                  className="ml-1 rounded px-1 text-gray-500 hover:bg-gray-100"
                                  onClick={() => removeManager(id)}
                                  title="Remove"
                                >
                                  ✕
                                </button>
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action row */}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-gray-500">
                    Last updated: {fmt(activeUser.updatedAt)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn btn-primary"
                      onClick={saveEdits}
                      disabled={saving}
                    >
                      {saving ? "Saving…" : "Save Changes"}
                    </button>

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
                        disabled={
                          working ||
                          activeUser.role === "superadmin" ||
                          activeUser._id === me?._id
                        }
                        onClick={hardDelete}
                        title={
                          activeUser.role === "superadmin"
                            ? "Cannot delete a superadmin"
                            : activeUser._id === me?._id
                            ? "You cannot delete your own account"
                            : "Delete permanently"
                        }
                      >
                        Hard Delete
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- UI helpers ---------- */
function Field({ label, children }) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium text-gray-700">{label}</div>
      {children}
    </div>
  );
}
