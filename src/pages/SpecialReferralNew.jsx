import { useEffect, useState } from "react";
import Navbar from "../components/Navbar.jsx";
import api from "../lib/api.js";
import { useAuthStore } from "../store/authStore.js";

const DEFAULT_LEFT_LOGO = "/left-logo.png";
const DEFAULT_RIGHT_LOGO = "/right-logo.png";


function ensureAuthOnRefresh() {
  const s = useAuthStore.getState?.();
  const token =
    s?.accessToken ||
    (typeof localStorage !== "undefined" && localStorage.getItem("accessToken")) ||
    null;

  if (token && token !== "null" && token !== "undefined" && token.trim() !== "") {
    if (!s?.accessToken && s?.setTokens) s.setTokens({ accessToken: token });
    // ensure the very first request after refresh has the header
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    return true;
  } else {
    delete api.defaults.headers.common.Authorization;
    return false;
  }
}


export default function SpecialReferralNew() {
  // const accessToken = useAuthStore(s => s.accessToken);

  const [form, setForm] = useState({
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
    presentedOn: "",
    headHRName: "",
    directorOrMDName: "",
  });

  const [photo, setPhoto] = useState(null);
  // kept for potential future toggle; not shown in the UI
  const [leftLogo, setLeftLogo] = useState(null);
  const [rightLogo, setRightLogo] = useState(null);

  const [msg, setMsg] = useState(null);
  const [creating, setCreating] = useState(false);

  const [list, setList] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listErr, setListErr] = useState(null);

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
  // make sure axios has the auth header on first paint (hard refresh)
  ensureAuthOnRefresh();
  // now safely load
  loadSnapshots();
}, []); // run once on mount


  // fetch a public asset and return a File for FormData (for default logos)
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

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v ?? ""));

    if (photo) fd.append("personPhoto", photo);

    // attach default logos automatically if custom not provided
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
      setPhoto(null);
      await loadSnapshots();
    } catch (e) {
      setMsg(e.response?.data?.error || "Failed to save");
    } finally {
      setCreating(false);
      setTimeout(() => setMsg(null), 2500);
    }
  };

  // ---- PDF helpers (Authenticated via axios -> Blob URL) ----
  const openPdf = async (id) => {
    // open a tab immediately to avoid popup blockers
    const w = window.open("", "_blank");
    try {
      const { data } = await api.get(`/special-referrals/${id}/pdf`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(
        new Blob([data], { type: "application/pdf" })
      );
      if (w) {
        w.location.href = url;
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      // revoke later (after navigation finishes)
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      if (w) w.close();
      // show a friendly message
      setMsg("Failed to open PDF. Please try Download instead.");
      setTimeout(() => setMsg(null), 3000);
    }
  };

  const downloadPdf = async (id) => {
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
    }
  };

  // Optional print (also authenticated)
  // const printPdf = async (id) => {
  //   try {
  //     const { data } = await api.get(`/special-referrals/${id}/pdf`, { responseType: "blob" });
  //     const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
  //     const iframe = document.createElement("iframe");
  //     iframe.style.position = "fixed";
  //     iframe.style.right = "-9999px";
  //     iframe.style.bottom = "-9999px";
  //     iframe.src = url;
  //     document.body.appendChild(iframe);
  //     iframe.onload = () => {
  //       try {
  //         iframe.contentWindow?.focus();
  //         iframe.contentWindow?.print();
  //       } finally {
  //         setTimeout(() => {
  //           URL.revokeObjectURL(url);
  //           document.body.removeChild(iframe);
  //         }, 1500);
  //       }
  //     };
  //   } catch {
  //     setMsg("Print failed. Try Open, then print in the new tab.");
  //     setTimeout(() => setMsg(null), 3000);
  //   }
  // };

  const fmt = (d) => (d ? new Date(d).toLocaleDateString() : "—");

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
                  />
                </Field>
                <Field label="Grade">
                  <input
                    className="input"
                    value={form.grade}
                    onChange={(e) => setF({ grade: e.target.value })}
                    placeholder="e.g., M3"
                  />
                </Field>
                <Field label="Photo">
                  <input
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
                  />
                </Field>
                <Field label="Service Tenure (text)">
                  <input
                    className="input"
                    value={form.serviceTenureText}
                    onChange={(e) =>
                      setF({ serviceTenureText: e.target.value })
                    }
                    placeholder="e.g., 4 yrs 8 mos"
                  />
                </Field>
                <Field label="Date of Birth">
                  <input
                    className="input"
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => setF({ dateOfBirth: e.target.value })}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Total Exp (domain & industry)">
                  <input
                    className="input"
                    value={form.totalExperienceText}
                    onChange={(e) =>
                      setF({ totalExperienceText: e.target.value })
                    }
                    placeholder="e.g., 8 yrs domain, 12 yrs industry"
                  />
                </Field>
                <Field label="Previous Organization">
                  <input
                    className="input"
                    value={form.previousOrganization}
                    onChange={(e) =>
                      setF({ previousOrganization: e.target.value })
                    }
                    placeholder="e.g., ABC Ltd."
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
                    value={form.presentedOn}
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
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => openPdf(r._id)}
                            title="Open PDF"
                          >
                            Open
                          </button>
                          <button
                            className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => downloadPdf(r._id)}
                            title="Download PDF"
                          >
                            Download
                          </button>
                          {/* <button
                            className="btn btn-sm bg-indigo-600 hover:bg-indigo-700 text-white"
                            onClick={() => printPdf(r._id)}
                            title="Print PDF"
                          >
                            Print
                          </button> */}
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
    </div>
  );
}

/* UI helpers */
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
