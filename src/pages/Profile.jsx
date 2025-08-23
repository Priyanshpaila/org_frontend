import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar.jsx";
import api from "../lib/api.js";
import { useAuthStore } from "../store/authStore.js";

export default function Profile() {
  const me = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  // server-fresh full profile (for read-only details)
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  // editable profile form (only allowed fields)
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [touched, setTouched] = useState({});

  // change password form
  const [cpw, setCpw] = useState(""); // current
  const [npw, setNpw] = useState(""); // new
  const [rpw, setRpw] = useState(""); // repeat
  const [savingPwd, setSavingPwd] = useState(false);

  // load fresh details
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        // start with store values (instant render)
        setForm({
          name: me?.name || "",
          email: me?.email || "",
          phone: me?.phone || "",
        });
        if (me?._id) {
          const { data } = await api.get(`/users/${me._id}`);
          if (!mounted) return;
          setDetails(data);
          // prefer server values for editable fields
          setForm({
            name: data?.name || "",
            email: data?.email || "",
            phone: data?.phone || "",
          });
        } else {
          setDetails(me || null);
        }
      } catch (e) {
        setDetails(me || null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [me?._id]);

  const toast = (t) => {
    setMsg(t);
    setTimeout(() => setMsg(null), 2500);
  };
  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));
  const touch = (k) => setTouched((t) => ({ ...t, [k]: true }));

  /* ------------ validation (profile) ------------ */
  const emailOk = (e) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || "").trim());
  const phoneOk = (p) => !p || /^[0-9+\-() ]{6,18}$/.test(String(p));

  const profileErrors = useMemo(() => {
    const e = {};
    if (!form.name.trim()) e.name = "Full name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!emailOk(form.email)) e.email = "Enter a valid email";
    if (!phoneOk(form.phone))
      e.phone = "Enter a valid phone (digits and + - ( ) allowed)";
    return e;
  }, [form]);

  const profileInvalid = Object.keys(profileErrors).length > 0;
  const profileChanged = useMemo(() => {
    const base = {
      name: details?.name || me?.name || "",
      email: details?.email || me?.email || "",
      phone: details?.phone || me?.phone || "",
    };
    return (
      base.name !== form.name ||
      base.email !== form.email ||
      (base.phone || "") !== (form.phone || "")
    );
  }, [form, details, me]);

  /* ------------ update profile ------------ */
  const onSubmitProfile = async (e) => {
    e.preventDefault();
    setTouched({ name: true, email: true, phone: true });
    if (profileInvalid || !profileChanged) return;
    try {
      setSavingProfile(true);
      const { data } = await api.patch("/users/me/profile", {
        name: form.name,
        email: form.email,
        phone: form.phone,
      });
      // update store & local
      setUser(data);
      setDetails((d) => ({ ...(d || {}), ...data }));
      toast("Profile updated");
    } catch (e) {
      toast(e.response?.data?.error || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  /* ------------ password validation ------------ */
  const pwdErrors = useMemo(() => {
    const e = {};
    if (!cpw) e.cpw = "Current password is required";
    else if (cpw.length !== 8)
      e.cpw = "Current password must be exactly 8 characters";

    if (!npw) e.npw = "New password is required";
    else if (npw.length !== 8)
      e.npw = "New password must be exactly 8 characters";

    if (!rpw) e.rpw = "Confirm your new password";
    else if (rpw.length !== 8)
      e.rpw = "Confirmation must be exactly 8 characters";
    else if (npw !== rpw) e.rpw = "Passwords do not match";

    return e;
  }, [cpw, npw, rpw]);

  const pwdInvalid = Object.keys(pwdErrors).length > 0;

  /* ------------ change password ------------ */
  const onSubmitPassword = async (e) => {
    e.preventDefault();
    if (pwdInvalid) return;
    try {
      setSavingPwd(true);
      // Adjust this path if your backend differs:
      await api.post("/users/me/password", {
        currentPassword: cpw,
        newPassword: npw,
      });
      toast("Password updated");
      setCpw("");
      setNpw("");
      setRpw("");
    } catch (e) {
      // If endpoint missing, you'll get a clear error here
      toast(
        e.response?.data?.error ||
          "Failed to update password (endpoint missing?)"
      );
    } finally {
      setSavingPwd(false);
    }
  };

  const fmt = (d) => (d ? new Date(d).toLocaleDateString() : "—");

  return (
    <div className="min-h-full bg-gray-50">
      <Navbar />
      <div className="page">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xl font-semibold">My Profile</div>
          <div className="text-xs text-gray-500">
            Only name, email, phone are editable
          </div>
        </div>

        {msg && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
            {msg}
          </div>
        )}

        {/* Main layout */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Left: profile form + security */}
          <section className="space-y-4 lg:col-span-2">
            {/* Editable profile */}
            <Card title="Personal Information">
              <form onSubmit={onSubmitProfile} className="space-y-3">
                <Field
                  label="Full Name *"
                  error={touched.name && profileErrors.name}
                >
                  <input
                    className="input"
                    value={form.name}
                    onChange={(e) => setF({ name: e.target.value })}
                    onBlur={() => touch("name")}
                    required
                  />
                </Field>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field
                    label="Email *"
                    error={touched.email && profileErrors.email}
                  >
                    <input
                      className="input"
                      type="email"
                      value={form.email}
                      onChange={(e) => setF({ email: e.target.value })}
                      onBlur={() => touch("email")}
                      required
                    />
                  </Field>
                  <Field
                    label="Phone"
                    error={touched.phone && profileErrors.phone}
                    hint="Digits, + - ( ) allowed"
                  >
                    <input
                      className="input"
                      value={form.phone}
                      onChange={(e) => setF({ phone: e.target.value })}
                      onBlur={() => touch("phone")}
                    />
                  </Field>
                </div>

                <div className="pt-1">
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={
                      savingProfile || profileInvalid || !profileChanged
                    }
                    title={
                      !profileChanged
                        ? "No changes to save"
                        : profileInvalid
                        ? "Fix validation errors first"
                        : "Save"
                    }
                  >
                    {savingProfile ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </form>
            </Card>

            {/* Security */}
            {/* Security */}
            <Card title="Security">
              <form onSubmit={onSubmitPassword} className="space-y-3">
                <Field label="Current Password" error={pwdErrors.cpw}>
                  <div className="relative">
                    <input
                      className="input pr-12"
                      type="password"
                      value={cpw}
                      onChange={(e) => setCpw(e.target.value.slice(0, 8))}
                      autoComplete="current-password"
                      minLength={8}
                      maxLength={8}
                      inputMode="text"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-gray-500">
                      {cpw.length}/8
                    </span>
                  </div>
                </Field>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field
                    label="New Password"
                    error={pwdErrors.npw}
                    hint="Exactly 8 characters"
                  >
                    <div className="relative">
                      <input
                        className="input pr-12"
                        type="password"
                        value={npw}
                        onChange={(e) => setNpw(e.target.value.slice(0, 8))}
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={8}
                        inputMode="text"
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-gray-500">
                        {npw.length}/8
                      </span>
                    </div>
                  </Field>

                  <Field label="Confirm New Password" error={pwdErrors.rpw}>
                    <div className="relative">
                      <input
                        className="input pr-12"
                        type="password"
                        value={rpw}
                        onChange={(e) => setRpw(e.target.value.slice(0, 8))}
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={8}
                        inputMode="text"
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-gray-500">
                        {rpw.length}/8
                      </span>
                    </div>
                  </Field>
                </div>

                <div className="pt-1">
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={savingPwd || pwdInvalid}
                  >
                    {savingPwd ? "Updating…" : "Change Password"}
                  </button>
                </div>
              </form>
            </Card>
          </section>

          {/* Right: read-only profile summary */}
          <aside className="space-y-4">
            <Card title="Profile Summary">
              {loading ? (
                <div className="text-sm text-gray-500">Loading…</div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  <InfoRow
                    label="Full Name"
                    value={details?.name || me?.name || "—"}
                  />
                  <InfoRow
                    label="Email"
                    value={details?.email || me?.email || "—"}
                  />
                  <InfoRow label="Phone" value={details?.phone || "—"} />
                  <InfoRow label="Employee ID" value={details?.empId || "—"} />
                  <InfoRow
                    label="Role"
                    value={details?.role || me?.role || "—"}
                  />
                  <InfoRow label="Status" value={details?.status || "—"} />
                  <InfoRow
                    label="Department"
                    value={details?.department?.name || "—"}
                  />
                  <InfoRow
                    label="Division"
                    value={details?.division?.name || "—"}
                  />
                  <InfoRow
                    label="Designation"
                    value={details?.designation?.name || "—"}
                  />
                  <InfoRow
                    label="Date of Joining"
                    value={fmt(details?.dateOfJoining)}
                  />
                  <div>
                    <div className="mb-1 text-xs font-medium text-gray-500">
                      Reporting To
                    </div>
                    <div className="rounded-xl border p-2 text-sm">
                      {Array.isArray(details?.reportingTo) &&
                      details.reportingTo.length > 0 ? (
                        <ul className="list-disc pl-4">
                          {details.reportingTo.map((r) => (
                            <li key={r._id}>
                              {r.name} {r.empId ? `(${r.empId})` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                </div>
              )}
            </Card>

            <Card title="Tips">
              <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                <li>You can change your name, email, and phone here.</li>
                <li>
                  For department or designation changes, contact an admin.
                </li>
                <li>Use a strong, unique password. Minimum 8 characters.</li>
              </ul>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ---------------- UI bits ---------------- */

function Card({ title, children }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm backdrop-blur">
      {title && <div className="mb-3 text-base font-semibold">{title}</div>}
      {children}
    </div>
  );
}

function Field({ label, error, hint, children }) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium text-gray-700">{label}</div>
      {children}
      {error ? (
        <div className="mt-1 text-xs text-rose-600">{error}</div>
      ) : hint ? (
        <div className="mt-1 text-xs text-gray-500">{hint}</div>
      ) : null}
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
