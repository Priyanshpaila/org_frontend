import { useEffect, useState } from "react";
import Navbar from "../components/Navbar.jsx";
import api from "../lib/api.js";
import { useAuthStore } from "../store/authStore.js";
import RoleBadge from "../components/RoleBadge.jsx";
import { useNavigate } from "react-router-dom";

const STATUS_OPTIONS = ["active", "inactive", "vacant", "on_leave"];

export default function SuperAdmin() {
  const isSuper = useAuthStore((s) => s.isSuperAdmin());
  const me = useAuthStore((s) => s.user);
  const nav = useNavigate();

  useEffect(() => {
    if (!isSuper) nav("/");
  }, [isSuper]);

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [msg, setMsg] = useState(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [activeUser, setActiveUser] = useState(null);
  const [saving, setSaving] = useState(false);

  // Create forms
  const [newDept, setNewDept] = useState({ name: "", code: "" });
  const [newDiv, setNewDiv] = useState({ name: "", code: "" });
  const [newDesig, setNewDesig] = useState({
    name: "",
    priority: 1,
    description: "",
  });

  // Edit states
  const [editDeptId, setEditDeptId] = useState(null);
  const [editDept, setEditDept] = useState({ name: "", code: "" });
  const [editDivId, setEditDivId] = useState(null);
  const [editDiv, setEditDiv] = useState({ name: "", code: "" });
  const [editDesigId, setEditDesigId] = useState(null);
  const [editDesig, setEditDesig] = useState({
    name: "",
    priority: 1,
    description: "",
  });

  const load = async () => {
    const [{ data: u }, { data: dept }, { data: div }, { data: desig }] =
      await Promise.all([
        api.get("/users", { params: { limit: 200 } }),
        api.get("/meta/departments"),
        api.get("/meta/divisions"),
        api.get("/meta/designations"),
      ]);
    setUsers(u.items || []);
    setDepartments(dept || []);
    setDivisions(div || []);
    setDesignations(
      (desig || [])
        .slice()
        .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
    );
  };
  useEffect(() => {
    load();
  }, []);

  const toast = (t) => {
    setMsg(t);
    setTimeout(() => setMsg(null), 2500);
  };

  // ---------- USER MODAL ----------
  const openUserModal = async (id) => {
    setActiveId(id);
    setShowModal(true);
    try {
      const { data } = await api.get(`/users/${id}`);
      setActiveUser(data);
    } catch (e) {
      toast(e.response?.data?.error || "Failed to load user details");
      setShowModal(false);
      setActiveUser(null);
      setActiveId(null);
    }
  };
  const closeModal = () => {
    setShowModal(false);
    setActiveUser(null);
    setActiveId(null);
  };

  const changeRole = async (role) => {
    if (!activeUser?._id) return;
    if (!["user", "admin"].includes(role)) return toast("Invalid role");
    setSaving(true);
    try {
      await api.patch(`/users/${activeUser._id}/role`, { role });
      toast("Role updated");
      await load();
      const { data } = await api.get(`/users/${activeUser._id}`);
      setActiveUser(data);
    } catch (e) {
      toast(e.response?.data?.error || "Failed to change role");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (status) => {
    if (!activeUser?._id) return;
    if (!STATUS_OPTIONS.includes(status)) return toast("Invalid status");
    setSaving(true);
    try {
      await api.patch(`/users/${activeUser._id}`, { status });
      toast("Status updated");
      await load();
      const { data } = await api.get(`/users/${activeUser._id}`);
      setActiveUser(data);
    } catch (e) {
      toast(e.response?.data?.error || "Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  const hardDeleteUser = async () => {
    const u = activeUser;
    if (!u?._id) return;
    if (u.role === "superadmin") return toast("Cannot delete a superadmin");
    if (u._id === me?._id) return toast("You cannot delete your own account");
    if (
      !confirm(
        `Permanently delete ${u.name} (${u.email})? This cannot be undone.`
      )
    )
      return;
    setSaving(true);
    try {
      await api.delete(`/users/${u._id}`);
      toast("User permanently deleted");
      closeModal();
      load();
    } catch (e) {
      toast(e.response?.data?.error || "Failed to delete user");
    } finally {
      setSaving(false);
    }
  };

  const fmt = (d) => (d ? new Date(d).toLocaleDateString() : "—");

  // ------- DESIGNATION REORDER -------
  const move = (idx, dir) => {
    const next = [...designations];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    const temp = next[idx];
    next[idx] = next[j];
    next[j] = temp;
    next.forEach((d, i) => (d.priority = i + 1));
    setDesignations(next);
  };
  const saveReorder = async () => {
    try {
      const body = {
        items: designations.map((d) => ({ id: d._id, priority: d.priority })),
      };
      await api.patch("/meta/designations/reorder", body);
      toast("Designations reordered");
      load();
    } catch (e) {
      toast(e.response?.data?.error || "Failed to reorder");
    }
  };

  // ------- DEPARTMENTS CRUD -------
  const createDept = async (e) => {
    e.preventDefault();
    try {
      await api.post("/meta/departments", newDept);
      setNewDept({ name: "", code: "" });
      toast("Department created");
      load();
    } catch (e) {
      toast(e.response?.data?.error || "Failed to create department");
    }
  };
  const startEditDept = (d) => {
    setEditDeptId(d._id);
    setEditDept({ name: d.name || "", code: d.code || "" });
  };
  const saveDept = async (id) => {
    try {
      await api.patch(`/meta/departments/${id}`, editDept);
      setEditDeptId(null);
      toast("Department updated");
      load();
    } catch (e) {
      toast(e.response?.data?.error || "Failed to update department");
    }
  };
  const deleteDept = async (id) => {
    if (!confirm("Delete this department?")) return;
    try {
      await api.delete(`/meta/departments/${id}`);
      toast("Department deleted");
      load();
    } catch (e) {
      toast(e.response?.data?.error || "Failed to delete department");
    }
  };

  // ------- DIVISIONS CRUD -------
  const createDiv = async (e) => {
    e.preventDefault();
    try {
      await api.post("/meta/divisions", newDiv);
      setNewDiv({ name: "", code: "" });
      toast("Division created");
      load();
    } catch (e) {
      toast(e.response?.data?.error || "Failed to create division");
    }
  };
  const startEditDiv = (d) => {
    setEditDivId(d._id);
    setEditDiv({ name: d.name || "", code: d.code || "" });
  };
  const saveDiv = async (id) => {
    try {
      await api.patch(`/meta/divisions/${id}`, editDiv);
      setEditDivId(null);
      toast("Division updated");
      load();
    } catch (e) {
      toast(e.response?.data?.error || "Failed to update division");
    }
  };
  const deleteDiv = async (id) => {
    if (!confirm("Delete this division?")) return;
    try {
      await api.delete(`/meta/divisions/${id}`);
      toast("Division deleted");
      load();
    } catch (e) {
      toast(e.response?.data?.error || "Failed to delete division");
    }
  };

  // ------- DESIGNATIONS CRUD -------
  const createDesig = async (e) => {
    e.preventDefault();
    try {
      const body = { ...newDesig, priority: Number(newDesig.priority) || 1 };
      await api.post("/meta/designations", body);
      setNewDesig({ name: "", priority: 1, description: "" });
      toast("Designation created");
      load();
    } catch (e) {
      toast(e.response?.data?.error || "Failed to create designation");
    }
  };
  const startEditDesig = (d) => {
    setEditDesigId(d._id);
    setEditDesig({
      name: d.name || "",
      priority: d.priority || 1,
      description: d.description || "",
    });
  };
  const saveDesig = async (id) => {
    try {
      const body = { ...editDesig, priority: Number(editDesig.priority) || 1 };
      await api.patch(`/meta/designations/${id}`, body);
      setEditDesigId(null);
      toast("Designation updated");
      load();
    } catch (e) {
      toast(e.response?.data?.error || "Failed to update designation");
    }
  };
  const deleteDesig = async (id) => {
    if (!confirm("Delete this designation?")) return;
    try {
      await api.delete(`/meta/designations/${id}`);
      toast("Designation deleted");
      load();
    } catch (e) {
      toast(e.response?.data?.error || "Failed to delete designation");
    }
  };

  return (
    <div className="min-h-full bg-gray-50">
      <Navbar />
      <div className="page">
        <div className="mb-2 text-xl font-semibold">Superadmin Dashboard</div>
        {msg && (
          <div className="mb-3 rounded-xl bg-amber-50 p-2 text-sm text-amber-800">
            {msg}
          </div>
        )}

        {/* Row 1: Users + Reorder */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Users */}
          <div className="card p-4">
            <div className="mb-2 font-semibold">Users</div>

            {/* Mobile: cards */}
            <div className="space-y-2 md:hidden">
              {users.map((u) => (
                <button
                  key={u._id}
                  onClick={() => openUserModal(u._id)}
                  className="w-full rounded-xl border p-3 text-left shadow-sm hover:shadow transition"
                  title="View & manage"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium truncate">{u.name}</div>
                    <RoleBadge role={u.role} />
                  </div>
                  <div className="text-xs text-gray-600 truncate">
                    {u.email}
                  </div>
                  <div className="mt-1">
                    <span className="badge">{u.status || "active"}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block">
              <div className="max-h-[420px] overflow-auto">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="text-left">
                        <th className="p-2">Name</th>
                        <th className="p-2">Email</th>
                        <th className="p-2">Role</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u._id} className="border-t">
                          <td className="p-2">
                            <button
                              className="max-w-[220px] truncate underline underline-offset-2 hover:text-blue-700"
                              onClick={() => openUserModal(u._id)}
                              title="View & manage"
                            >
                              {u.name}
                            </button>
                          </td>
                          <td className="p-2 break-all">{u.email}</td>
                          <td className="p-2">
                            <RoleBadge role={u.role} />
                          </td>
                          <td className="p-2">
                            <span className="badge">
                              {u.status || "active"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Reorder */}
          <div className="card p-4">
            <div className="mb-2 font-semibold">
              Designation Priority (Drag-like controls)
            </div>
            <div className="space-y-2">
              {designations.map((d, idx) => (
                <div
                  key={d._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-2"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{d.name}</div>
                    <div className="text-xs text-gray-500">
                      priority: {d.priority}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-ghost"
                      onClick={() => move(idx, -1)}
                    >
                      ↑
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => move(idx, +1)}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
              <button
                className="btn btn-primary w-full sm:w-auto"
                onClick={saveReorder}
              >
                Save Order
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Departments + Divisions */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Departments */}
          <div className="card p-4">
            <div className="mb-2 text-lg font-semibold">Departments</div>
            <form
              className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3"
              onSubmit={createDept}
            >
              <input
                className="input sm:col-span-2"
                placeholder="Name"
                value={newDept.name}
                onChange={(e) =>
                  setNewDept((v) => ({ ...v, name: e.target.value }))
                }
                required
              />
              <input
                className="input"
                placeholder="Code"
                value={newDept.code}
                onChange={(e) =>
                  setNewDept((v) => ({ ...v, code: e.target.value }))
                }
              />
              <button className="btn btn-primary sm:col-span-1" type="submit">
                Add
              </button>
            </form>
            <div className="max-h-[320px] overflow-auto">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="p-2">Name</th>
                      <th className="p-2">Code</th>
                      <th className="p-2 w-40">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((d) => (
                      <tr key={d._id} className="border-t">
                        <td className="p-2">
                          {editDeptId === d._id ? (
                            <input
                              className="input"
                              value={editDept.name}
                              onChange={(e) =>
                                setEditDept((v) => ({
                                  ...v,
                                  name: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            d.name
                          )}
                        </td>
                        <td className="p-2">
                          {editDeptId === d._id ? (
                            <input
                              className="input"
                              value={editDept.code || ""}
                              onChange={(e) =>
                                setEditDept((v) => ({
                                  ...v,
                                  code: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            d.code || "—"
                          )}
                        </td>
                        <td className="p-2">
                          {editDeptId === d._id ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                className="btn btn-primary"
                                onClick={() => saveDept(d._id)}
                              >
                                Save
                              </button>
                              <button
                                className="btn btn-ghost"
                                onClick={() => setEditDeptId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <button
                                className="btn btn-ghost"
                                onClick={() => startEditDept(d)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-ghost"
                                onClick={() => deleteDept(d._id)}
                              >
                                Delete
                              </button>
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

          {/* Divisions */}
          <div className="card p-4">
            <div className="mb-2 text-lg font-semibold">Divisions</div>
            <form
              className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3"
              onSubmit={createDiv}
            >
              <input
                className="input sm:col-span-2"
                placeholder="Name"
                value={newDiv.name}
                onChange={(e) =>
                  setNewDiv((v) => ({ ...v, name: e.target.value }))
                }
                required
              />
              <input
                className="input"
                placeholder="Code"
                value={newDiv.code}
                onChange={(e) =>
                  setNewDiv((v) => ({ ...v, code: e.target.value }))
                }
              />
              <button className="btn btn-primary sm:col-span-1" type="submit">
                Add
              </button>
            </form>
            <div className="max-h-[320px] overflow-auto">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="p-2">Name</th>
                      <th className="p-2">Code</th>
                      <th className="p-2 w-40">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {divisions.map((d) => (
                      <tr key={d._id} className="border-t">
                        <td className="p-2">
                          {editDivId === d._id ? (
                            <input
                              className="input"
                              value={editDiv.name}
                              onChange={(e) =>
                                setEditDiv((v) => ({
                                  ...v,
                                  name: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            d.name
                          )}
                        </td>
                        <td className="p-2">
                          {editDivId === d._id ? (
                            <input
                              className="input"
                              value={editDiv.code || ""}
                              onChange={(e) =>
                                setEditDiv((v) => ({
                                  ...v,
                                  code: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            d.code || "—"
                          )}
                        </td>
                        <td className="p-2">
                          {editDivId === d._id ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                className="btn btn-primary"
                                onClick={() => saveDiv(d._id)}
                              >
                                Save
                              </button>
                              <button
                                className="btn btn-ghost"
                                onClick={() => setEditDivId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <button
                                className="btn btn-ghost"
                                onClick={() => startEditDiv(d)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-ghost"
                                onClick={() => deleteDiv(d._id)}
                              >
                                Delete
                              </button>
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
        </div>

        {/* Row 3: Designations CRUD */}
        <div className="mt-4 card p-4">
          <div className="mb-2 text-lg font-semibold">Designations (CRUD)</div>

          <form
            className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-4"
            onSubmit={createDesig}
          >
            <input
              className="input"
              placeholder="Name"
              value={newDesig.name}
              onChange={(e) =>
                setNewDesig((v) => ({ ...v, name: e.target.value }))
              }
              required
            />
            <input
              className="input"
              type="number"
              min="1"
              placeholder="Priority"
              value={newDesig.priority}
              onChange={(e) =>
                setNewDesig((v) => ({ ...v, priority: e.target.value }))
              }
              required
            />
            <input
              className="input md:col-span-2"
              placeholder="Description (optional)"
              value={newDesig.description}
              onChange={(e) =>
                setNewDesig((v) => ({ ...v, description: e.target.value }))
              }
            />
            <button className="btn btn-primary md:col-span-1" type="submit">
              Add
            </button>
          </form>

          <div className="max-h-[420px] overflow-auto">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="p-2">Name</th>
                    <th className="p-2">Priority</th>
                    <th className="p-2">Description</th>
                    <th className="p-2 w-40">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {designations.map((d) => (
                    <tr key={d._id} className="border-t">
                      <td className="p-2">
                        {editDesigId === d._id ? (
                          <input
                            className="input"
                            value={editDesig.name}
                            onChange={(e) =>
                              setEditDesig((v) => ({
                                ...v,
                                name: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          d.name
                        )}
                      </td>
                      <td className="p-2">
                        {editDesigId === d._id ? (
                          <input
                            className="input w-24"
                            type="number"
                            min="1"
                            value={editDesig.priority}
                            onChange={(e) =>
                              setEditDesig((v) => ({
                                ...v,
                                priority: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          d.priority
                        )}
                      </td>
                      <td className="p-2">
                        {editDesigId === d._id ? (
                          <input
                            className="input"
                            value={editDesig.description || ""}
                            onChange={(e) =>
                              setEditDesig((v) => ({
                                ...v,
                                description: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          d.description || "—"
                        )}
                      </td>
                      <td className="p-2">
                        {editDesigId === d._id ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="btn btn-primary"
                              onClick={() => saveDesig(d._id)}
                            >
                              Save
                            </button>
                            <button
                              className="btn btn-ghost"
                              onClick={() => setEditDesigId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="btn btn-ghost"
                              onClick={() => startEditDesig(d)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-ghost"
                              onClick={() => deleteDesig(d._id)}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 text-xs text-gray-600">
            Tip: You can either edit a designation’s priority here (then
            “Save”), or use the “Designation Priority” block above to reorder
            many at once and click “Save Order”.
          </div>
        </div>
      </div>
      {/* ---------- USER DETAILS MODAL (centered, mobile-safe) ---------- */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/40" onClick={closeModal} />

          {/* Centering wrapper (scrollable on tiny phones) */}
          <div
            className="relative flex min-h-[100dvh] items-center justify-center p-3 sm:p-6"
            style={{
              paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)",
              paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)",
            }}
          >
            {/* Modal card */}
            <div
              role="dialog"
              aria-modal="true"
              className="
          relative z-10 bg-white shadow-2xl rounded-2xl w-[min(100vw-1.5rem,46rem)]
          md:w-[min(100vw-3rem,52rem)] overflow-hidden
        "
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b p-4">
                <div>
                  <div className="text-xl font-semibold">
                    {activeUser?.name || "User"}
                  </div>
                  <div className="text-sm text-gray-500">
                    {activeUser?.empId || activeUser?.email}
                  </div>
                </div>
                <button className="btn btn-ghost" onClick={closeModal}>
                  ✕
                </button>
              </div>

              {/* Scrollable content (never exceeds viewport) */}
              <div className="p-5 overflow-y-auto max-h-[min(88dvh,calc(100svh-3rem))] md:max-h-[min(90dvh,calc(100svh-6rem))]">
                {!activeUser ? (
                  <div>Loading…</div>
                ) : (
                  <>
                    {/* details */}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <InfoRow label="Email" value={activeUser.email} />
                      <InfoRow
                        label="Employee ID"
                        value={activeUser.empId || "—"}
                      />
                      <InfoRow
                        label="Department"
                        value={activeUser.department?.name || "—"}
                      />
                      <InfoRow
                        label="Division"
                        value={activeUser.division?.name || "—"}
                      />
                      <InfoRow
                        label="Designation"
                        value={activeUser.designation?.name || "—"}
                      />
                      <InfoRow
                        label="Date of Joining"
                        value={fmt(activeUser.dateOfJoining)}
                      />
                      <InfoRow
                        label="Status"
                        value={activeUser.status || "active"}
                      />
                      <InfoRow
                        label="Role"
                        value={<RoleBadge role={activeUser.role} />}
                      />
                      <div className="md:col-span-2">
                        <div className="mb-1 text-xs font-medium text-gray-500">
                          Reporting To
                        </div>
                        <div className="rounded-xl border p-2 text-sm">
                          {Array.isArray(activeUser.reportingTo) &&
                          activeUser.reportingTo.length > 0
                            ? activeUser.reportingTo.map((r) => (
                                <div key={r._id}>
                                  {r.name} {r.empId ? `(${r.empId})` : ""}
                                </div>
                              ))
                            : "—"}
                        </div>
                      </div>
                    </div>

                    {/* actions */}
                    <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium">Change Role</div>
                        {activeUser.role === "superadmin" ? (
                          <span className="badge">superadmin</span>
                        ) : (
                          <select
                            className="select w-full"
                            disabled={saving}
                            value={activeUser.role}
                            onChange={(e) => changeRole(e.target.value)}
                          >
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                          </select>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium">Change Status</div>
                        <select
                          className="select w-full"
                          disabled={saving}
                          value={activeUser.status || "active"}
                          onChange={(e) => changeStatus(e.target.value)}
                        >
                          {["active", "inactive", "vacant", "on_leave"].map(
                            (s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      <div className="flex items-center justify-end md:justify-start">
                        <button
                          className="btn bg-red-600 text-white hover:bg-red-700 w-full md:w-auto"
                          disabled={
                            saving ||
                            activeUser.role === "superadmin" ||
                            activeUser._id === me?._id
                          }
                          onClick={hardDeleteUser}
                          title={
                            activeUser?.role === "superadmin"
                              ? "Cannot delete a superadmin"
                              : activeUser?._id === me?._id
                              ? "You cannot delete your own account"
                              : "Delete user"
                          }
                        >
                          Delete User
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-gray-500">{label}</div>
      <div className="rounded-xl border p-2 text-sm break-words">
        {value ?? "—"}
      </div>
    </div>
  );
}
