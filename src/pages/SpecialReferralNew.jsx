import { useEffect, useRef, useState } from "react";
import Navbar from "../components/Navbar.jsx";
import api from "../lib/api.js";
import { useAuthStore } from "../store/authStore.js";

const DEFAULT_LEFT_LOGO = "/left-logo.png";
const DEFAULT_RIGHT_LOGO = "/right-logo.png";

function ensureAuthOnRefresh() {
  const s = useAuthStore.getState?.();
  const token =
    s?.accessToken ||
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("accessToken")) ||
    null;

  if (
    token &&
    token !== "null" &&
    token !== "undefined" &&
    token.trim() !== ""
  ) {
    if (!s?.accessToken && s?.setTokens) s.setTokens({ accessToken: token });
    // ensure the very first request after refresh has the header
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    return true;
  } else {
    delete api.defaults.headers.common.Authorization;
    return false;
  }
}

/* ---------- helpers for tenure & age ---------- */
function calcTenure(fromStr) {
  if (!fromStr) return "";
  const from = new Date(fromStr);
  const to = new Date();
  if (Number.isNaN(from.getTime())) return "";

  let years = to.getFullYear() - from.getFullYear();
  let months = to.getMonth() - from.getMonth();
  let days = to.getDate() - from.getDate();

  if (days < 0) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return "";

  const parts = [];
  if (years > 0) parts.push(`${years} yr${years > 1 ? "s" : ""}`);
  parts.push(`${months} mo${months !== 1 ? "s" : ""}`);
  return parts.join(" ");
}

function calcAgeYears(dobStr) {
  if (!dobStr) return "";
  const dob = new Date(dobStr);
  if (Number.isNaN(dob.getTime())) return "";
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) years--;
  return years >= 0 ? String(years) : "";
}

// Local YYYY-MM-DD (avoids UTC off-by-one)
function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// factory for a clean form (used initially and on reset)
function makeEmptyForm() {
  return {
    personName: "",
    designation: "",
    grade: "",
    dateOfJoining: "",
    serviceTenureText: "",
    dateOfBirth: "",
    totalExperienceText: "",
    previousOrganization: "",
    qualifications: "",
    majorCertifications: "",
    meritsForVerticalMovement: "",
    positionSummary: "",
    additionalCommentsHeadHR: "",
    commentsDirectorsOrMD: "",
    finalDecisionTaken: "",
    presentedOn: todayLocal(), // default to today
    headHRName: "",
    directorOrMDName: "",
  };
}

export default function SpecialReferralNew() {
  const [form, setForm] = useState(makeEmptyForm());

  const [photo, setPhoto] = useState(null);
  const [leftLogo, setLeftLogo] = useState(null);
  const [rightLogo, setRightLogo] = useState(null);

  const [msg, setMsg] = useState(null);
  const [creating, setCreating] = useState(false);

  const [list, setList] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listErr, setListErr] = useState(null);

  // 🔹 loader states for buttons
  const [loadingOpenId, setLoadingOpenId] = useState(null);
  const [loadingDownloadId, setLoadingDownloadId] = useState(null);
  const [loadingDeleteId, setLoadingDeleteId] = useState(null);

  // 🔹 modal state for delete confirmation
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [confirmName, setConfirmName] = useState("");

  // refs for resetting DOM elements (form + file input)
  const formRef = useRef(null);
  const photoRef = useRef(null);

  const setF = (p) => setForm((f) => ({ ...f, ...p }));

  const loadSnapshots = async () => {
    try {
      setListErr(null);
      setListLoading(true);
      const { data } = await api.get("/special-referrals", {
        params: { limit: 100, sort: "-createdAt" },
      });
      setList(
        Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
          ? data
          : []
      );
    } catch (e) {
      setList([]);
      setListErr(
        e?.response?.status === 404
          ? "List endpoint missing. Please add GET /special-referrals on the server."
          : "Failed to load snapshots."
      );
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    ensureAuthOnRefresh();
    loadSnapshots();
  }, []);

  // 🌟 Auto-calc Service Tenure whenever Date of Joining changes
  useEffect(() => {
    if (!form.dateOfJoining) return;
    const t = calcTenure(form.dateOfJoining);
    setF({ serviceTenureText: t });
  }, [form.dateOfJoining]);

  const fetchPublicAsFile = async (path, fallbackName) => {
    try {
      const res = await fetch(path, { cache: "no-cache" });
      if (!res.ok) return null;
      const blob = await res.blob();
      const name = path.split("/").pop() || fallbackName;
      const type = blob.type || "image/png";
      return new File([blob], name, { type });
    } catch {
      return null;
    }
  };

  const resetForm = () => {
    setForm(makeEmptyForm()); // reset controlled fields
    setPhoto(null);
    setLeftLogo(null);
    setRightLogo(null);

    // reset DOM form & file input
    if (formRef.current) formRef.current.reset();
    if (photoRef.current) photoRef.current.value = "";
  };

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);

    const fd = new FormData();
    // ✅ Ensure presentedOn is never empty
    const payload = { ...form, presentedOn: form.presentedOn || todayLocal() };
    Object.entries(payload).forEach(([k, v]) => fd.append(k, v ?? ""));
    if (photo) fd.append("personPhoto", photo);

    if (leftLogo) {
      fd.append("leftLogo", leftLogo);
    } else {
      const f = await fetchPublicAsFile(DEFAULT_LEFT_LOGO, "left-logo.png");
      if (f) fd.append("leftLogo", f);
    }
    if (rightLogo) {
      fd.append("rightLogo", rightLogo);
    } else {
      const f = await fetchPublicAsFile(DEFAULT_RIGHT_LOGO, "right-logo.png");
      if (f) fd.append("rightLogo", f);
    }

    try {
      setCreating(true);
      const { data } = await api.post("/special-referrals", fd);
      setMsg(`Saved. Record ID: ${data.id}`);

      // ⬅️ reset everything after successful save
      resetForm();

      // reload list
      await loadSnapshots();
    } catch (e) {
      setMsg(e.response?.data?.error || "Failed to save");
    } finally {
      setCreating(false);
      setTimeout(() => setMsg(null), 2500);
    }
  };

  // ---- PDF helper: open only after loaded ----
  const openPdf = async (id) => {
    setLoadingOpenId(id);
    try {
      const { data } = await api.get(`/special-referrals/${id}/pdf`, {
        responseType: "blob",
      });

      const blob = new Blob([data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      // Try normal open first
      const newTab = window.open(url, "_blank", "noopener,noreferrer");

      if (!newTab) {
        // Fallback if popup was blocked
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      // Revoke after a short delay (gives the tab time to load the blob)
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    } catch (err) {
      setMsg("Failed to open PDF. You can try Download instead.");
      setTimeout(() => setMsg(null), 3000);
    } finally {
      setLoadingOpenId(null);
    }
  };

  const downloadPdf = async (id) => {
    setLoadingDownloadId(id);
    try {
      const { data } = await api.get(`/special-referrals/${id}/pdf`, {
        responseType: "blob",
      });
      const blob = new Blob([data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `profile-snapshot-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch {
      setMsg("Download failed.");
      setTimeout(() => setMsg(null), 3000);
    } finally {
      setLoadingDownloadId(null);
    }
  };

  // Delete snapshot (actual API call)
  const deleteSnapshot = async (id, personName) => {
    setLoadingDeleteId(id);
    try {
      await api.delete(`/special-referrals/${id}`);
      // Optimistic update
      setList((prev) => prev.filter((x) => x._id !== id));
      setMsg("Snapshot deleted.");
      setTimeout(() => setMsg(null), 2000);
    } catch (err) {
      const errMsg =
        err?.response?.data?.error ||
        (err?.response?.status === 404
          ? "Snapshot not found."
          : "Failed to delete snapshot.");
      setMsg(errMsg);
      setTimeout(() => setMsg(null), 3000);
    } finally {
      setLoadingDeleteId(null);
      setConfirmOpen(false);
      setConfirmId(null);
      setConfirmName("");
    }
  };

  const fmt = (d) => (d ? new Date(d).toLocaleDateString() : "—");

  // 🔢 derived age label for UI
  const ageYears = calcAgeYears(form.dateOfBirth);

  return (
    <div className="min-h-full bg-gray-50">
      <Navbar />
      <div className="page">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">New Profile Snapshot</div>
            <div className="text-xs text-gray-500">
              Fill details and save. Logos are taken from your public folder by
              default.
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <LogoPreview />
          </div>
        </div>

        {msg && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-2 text-amber-800">
            {msg}
          </div>
        )}

        {/* Form */}
        <form
          ref={formRef}
          onSubmit={submit}
          className="grid grid-cols-1 gap-4 lg:grid-cols-3"
        >
          {/* Left column */}
          <section className="lg:col-span-2 space-y-4">
            <Card title="Identity">
              <Field label="Name *">
                <input
                  className="input"
                  value={form.personName}
                  onChange={(e) => setF({ personName: e.target.value })}
                  placeholder="Full name"
                  required
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Designation">
                  <input
                    className="input"
                    value={form.designation}
                    onChange={(e) => setF({ designation: e.target.value })}
                    placeholder="e.g., Sr. Manager"
                    required
                  />
                </Field>
                <Field label="Grade">
                  <input
                    className="input"
                    value={form.grade}
                    onChange={(e) => setF({ grade: e.target.value })}
                    placeholder="e.g., M3"
                    required
                  />
                </Field>
                <Field label="Photo">
                  <input
                    ref={photoRef}
                    required
                    className="input"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                  />
                </Field>
              </div>
            </Card>

            <Card title="Employment">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Date of Joining">
                  <input
                    className="input"
                    type="date"
                    value={form.dateOfJoining}
                    onChange={(e) => setF({ dateOfJoining: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Service Tenure (HIRA/RRISPAT)">
                  <input
                    className="input"
                    value={form.serviceTenureText}
                    onChange={(e) =>
                      setF({ serviceTenureText: e.target.value })
                    }
                    placeholder="e.g., 4 yrs 8 mos"
                    required
                  />
                </Field>
                <Field label="Date of Birth">
                  {/* input + live age beside it */}
                  <div className="flex items-center gap-2">
                    <input
                      className="input"
                      type="date"
                      value={form.dateOfBirth}
                      onChange={(e) => setF({ dateOfBirth: e.target.value })}
                      required
                    />
                    <span className="text-xs text-gray-600 whitespace-nowrap">
                      {ageYears ? `(${ageYears} yrs)` : ""}
                    </span>
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Total Work Exp (domain & industry)">
                  <input
                    className="input"
                    value={form.totalExperienceText}
                    onChange={(e) =>
                      setF({ totalExperienceText: e.target.value })
                    }
                    placeholder="e.g., 8 yrs domain, 12 yrs industry"
                    required
                  />
                </Field>
                <Field label="Previous Organizations (max upto 3)">
                  <textarea
                    className="textarea border-gray-300 border-[1px] rounded p-1"
                    rows={3}
                    value={form.previousOrganization}
                    onChange={(e) =>
                      setF({ previousOrganization: e.target.value })
                    }
                    placeholder="e.g., ABC Ltd."
                    required
                  />
                </Field>
              </div>
            </Card>
             <Card title="Background">
              <Field label="Qualifications (one per line)">
                <textarea
                  className="textarea"
                  rows={3}
                  value={form.qualifications}
                  onChange={(e) => setF({ qualifications: e.target.value })}
                  placeholder={"MBA, XYZ University\nB.Tech, ABC College"}
                />
              </Field>
              <Field label="Major Certification(s) (one per line)">
                <textarea
                  className="textarea"
                  rows={3}
                  value={form.majorCertifications}
                  onChange={(e) =>
                    setF({ majorCertifications: e.target.value })
                  }
                  placeholder={"PMP\nLean Six Sigma Black Belt"}
                />
              </Field>
              <Field label="Merit for vertical movement (bullets – one per line)">
                <textarea
                  className="textarea"
                  rows={4}
                  value={form.meritsForVerticalMovement}
                  onChange={(e) =>
                    setF({ meritsForVerticalMovement: e.target.value })
                  }
                  placeholder={
                    "Delivered 25% YoY growth\nBuilt a cross-functional team"
                  }
                />
              </Field>
              <Field label="Position Summary">
                <textarea
                  className="textarea"
                  rows={5}
                  value={form.positionSummary}
                  onChange={(e) => setF({ positionSummary: e.target.value })}
                  placeholder="Brief summary of the position and key responsibilities…"
                />
              </Field>
            </Card>
          </section>

          {/* Right column */}
          <section className="space-y-4">
            <Card title="Comments">
              <Field label="Additional Comments or Note(s) by Head HR">
                <textarea
                  className="textarea"
                  rows={4}
                  value={form.additionalCommentsHeadHR}
                  onChange={(e) =>
                    setF({ additionalCommentsHeadHR: e.target.value })
                  }
                />
              </Field>
              <Field label="Comments of Director(s) or MD">
                <textarea
                  className="textarea"
                  rows={4}
                  value={form.commentsDirectorsOrMD}
                  onChange={(e) =>
                    setF({ commentsDirectorsOrMD: e.target.value })
                  }
                />
              </Field>
              <Field label="Final Decision taken">
                <textarea
                  className="textarea"
                  rows={4}
                  value={form.finalDecisionTaken}
                  onChange={(e) => setF({ finalDecisionTaken: e.target.value })}
                />
              </Field>
            </Card>

            <Card title="Presentation & Sign-off">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Presented On">
                  <input
                    className="input"
                    type="date"
                    value={form.presentedOn} // fully controlled by state
                    onChange={(e) => setF({ presentedOn: e.target.value })}
                  />
                </Field>
                <div className="hidden md:block" />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Head-HR Name">
                  <input
                    className="input"
                    value={form.headHRName}
                    onChange={(e) => setF({ headHRName: e.target.value })}
                    placeholder="e.g., Jane Doe"
                  />
                </Field>
                <Field label="Director/MD Name">
                  <input
                    className="input"
                    value={form.directorOrMDName}
                    onChange={(e) => setF({ directorOrMDName: e.target.value })}
                    placeholder="e.g., John Smith"
                  />
                </Field>
              </div>

              <div className="mt-3 rounded-xl border border-gray-200 p-3 bg-white/60">
                <div className="mb-2 text-sm font-medium text-gray-700">
                  Brand Logos (default)
                </div>
                <div className="flex items-center gap-3">
                  <img
                    src={DEFAULT_LEFT_LOGO}
                    alt="Left logo"
                    className="h-10 w-auto object-contain rounded"
                  />
                  <span className="text-xs text-gray-500">
                    These will be used in the PDF automatically.
                  </span>
                  <img
                    src={DEFAULT_RIGHT_LOGO}
                    alt="Right logo"
                    className="h-10 w-auto object-contain rounded ml-auto"
                  />
                </div>
              </div>
            </Card>

            <Card>
              <button
                className="btn btn-primary w-full"
                type="submit"
                disabled={creating}
              >
                {creating ? "Saving…" : "Save Snapshot"}
              </button>
            </Card>
          </section>
        </form>

        {/* Snapshots list */}
        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-lg font-semibold">Snapshots</div>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-ghost"
                onClick={loadSnapshots}
                disabled={listLoading}
              >
                {listLoading ? "Loading…" : "Refresh"}
              </button>
            </div>
          </div>

        <div className="card p-0 overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full min-w-[840px] text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <Th>Name</Th>
                  <Th>Designation</Th>
                  <Th>Grade</Th>
                  <Th>Presented On</Th>
                  <Th>Created</Th>
                  <Th className="text-right pr-3">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r._id} className="border-t">
                    <Td className="font-medium">
                      {r.personName || r.name || "—"}
                    </Td>
                    <Td>{r.designation || "—"}</Td>
                    <Td>{r.grade || "—"}</Td>
                    <Td>{fmt(r.presentedOn)}</Td>
                    <Td>{fmt(r.createdAt)}</Td>
                    <Td className="text-right pr-3">
                      <div className="flex justify-end gap-2">
                        {/* Open */}
                        <button
                          className="btn btn-primary btn-sm flex items-center gap-2"
                          onClick={() => openPdf(r._id)}
                          disabled={loadingOpenId === r._id}
                          title="Open PDF"
                        >
                          {loadingOpenId === r._id && (
                            <Spinner className="h-4 w-4" />
                          )}
                          Open
                        </button>

                        {/* Download */}
                        <button
                          className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
                          onClick={() => downloadPdf(r._id)}
                          disabled={loadingDownloadId === r._id}
                          title="Download PDF"
                        >
                          {loadingDownloadId === r._id && (
                            <Spinner className="h-4 w-4" />
                          )}
                          Download
                        </button>

                        {/* Delete (opens modal) */}
                        <button
                          className="btn btn-sm btn-ghost text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                          onClick={() => {
                            setConfirmId(r._id);
                            setConfirmName(r.personName || r.name || "");
                            setConfirmOpen(true);
                          }}
                          disabled={loadingDeleteId === r._id}
                          title="Delete snapshot"
                          aria-label="Delete snapshot"
                        >
                          {loadingDeleteId === r._id ? (
                            <Spinner className="h-4 w-4" />
                          ) : (
                            <TrashIcon className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!listLoading && list.length === 0 && (
              <div className="p-4 text-sm text-gray-600">
                No snapshots yet.
              </div>
            )}
            {listErr && (
              <div className="p-4 text-sm text-rose-700 bg-rose-50 border-t">
                {listErr}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* ===== Delete Confirm Modal ===== */}
      {confirmOpen && (
        <DeleteConfirmModal
          name={confirmName}
          onClose={() => {
            if (loadingDeleteId) return; // prevent closing during delete
            setConfirmOpen(false);
            setConfirmId(null);
            setConfirmName("");
          }}
          onConfirm={() => deleteSnapshot(confirmId, confirmName)}
          loading={Boolean(loadingDeleteId)}
        />
      )}
    </div>
  );
}

/* UI helpers unchanged (with tiny additions for icons/spinner) */
function Card({ title, children }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm backdrop-blur">
      {title && <div className="mb-3 text-base font-semibold">{title}</div>}
      {children}
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div>
      {label && (
        <div className="mb-1 text-sm font-medium text-gray-700">{label}</div>
      )}
      {children}
    </div>
  );
}
function Th({ children, className = "" }) {
  return (
    <th className={`p-2 text-xs font-semibold text-gray-600 ${className}`}>
      {children}
    </th>
  );
}
function Td({ children, className = "" }) {
  return <td className={`p-2 align-middle ${className}`}>{children}</td>;
}
function LogoPreview() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white/70 px-3 py-2">
      <img
        src={DEFAULT_LEFT_LOGO}
        alt="Left logo"
        className="h-6 w-auto object-contain"
      />
      <span className="text-xs text-gray-500">Using default logos</span>
      <img
        src={DEFAULT_RIGHT_LOGO}
        alt="Right logo"
        className="h-6 w-auto object-contain"
      />
    </div>
  );
}

/* NEW: simple inline spinner + trash icon (no deps) */
function Spinner({ className = "" }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

function TrashIcon({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 6h18M9 6v-.5a2.5 2.5 0 012.5-2.5h1A2.5 2.5 0 0115 5.5V6m-8 0l1 13a2 2 0 002 2h4a2 2 0 002-2l1-13M10 11v6M14 11v6"
      />
    </svg>
  );
}

/* NEW: Accessible delete confirmation modal */
function DeleteConfirmModal({ name, onClose, onConfirm, loading }) {
  // Close on ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
        <div className="mb-2 text-base font-semibold text-slate-900">
          Delete snapshot?
        </div>
        <div className="mb-4 text-sm text-slate-600">
          {name ? (
            <>You’re about to delete the snapshot for <span className="font-medium text-slate-800">“{name}”</span>. This action cannot be undone.</>
          ) : (
            <>You’re about to delete this snapshot. This action cannot be undone.</>
          )}
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            className="btn btn-ghost"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="btn bg-rose-600 text-white hover:bg-rose-700 flex items-center gap-2"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Spinner className="h-4 w-4" />} Delete
          </button>
        </div>
      </div>
    </div>
  );
}
