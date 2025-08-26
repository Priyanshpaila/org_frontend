import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api.js";
import { useAuthStore } from "../store/authStore.js";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); // exactly 8 chars enforced below
  const [showPwd, setShowPwd] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});

  const loginStore = useAuthStore((s) => s.login);
  const nav = useNavigate();
  const loc = useLocation();

  // --- validation ---
  const emailOk = (e) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || "").trim());
  const errors = useMemo(() => {
    const e = {};
    if (!email.trim()) e.email = "Email is required";
    else if (!emailOk(email)) e.email = "Enter a valid email";
    if (!password) e.password = "Password is required";
    else if (password.length !== 8)
      e.password = "Password must be exactly 8 characters";
    return e;
  }, [email, password]);
  const invalid = Object.keys(errors).length > 0;

  // --- submit ---
  const onSubmit = async (e) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    setErr(null);
    if (invalid) return;
    try {
      setLoading(true);
      const { data } = await api.post("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });
      loginStore({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      nav(loc.state?.from?.pathname || "/");
    } catch (e) {
      // graceful fallbacks
      if (e?.response?.data?.error) setErr(e.response.data.error);
      else if (e?.message?.includes("Network"))
        setErr(
          "Unable to reach the server. Please check your connection and try again."
        );
      else setErr("Login failed. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  // caps lock hint
  useEffect(() => {
    const handler = (ev) =>
      setCapsOn(
        Boolean(ev.getModifierState && ev.getModifierState("CapsLock"))
      );
    window.addEventListener("keydown", handler);
    window.addEventListener("keyup", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("keyup", handler);
    };
  }, []);

  // keep password capped at 8 chars, always
  const onPasswordChange = (v) => setPassword(v.slice(0, 8));

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-b from-brand-50 to-white px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white/90 p-6 shadow-sm backdrop-blur"
      >
        {/* Brand */}
        <div className="mb-5 flex items-center justify-center gap-3">
          <img
            src="/logo.png"
            alt="YourCompany logo"
            className="h-50 w-50 rounded-xl object-contain "
            loading="eager"
            width={110}
            height={110}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>

         <div className="mb-2 text-center text-2xl font-semibold">Login your account</div>

        {err && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">
            {err}
          </div>
        )}

        {/* Email */}
        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            className="input w-full"
            type="email"
            inputMode="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            required
            placeholder="you@company.com"
          />
          {touched.email && errors.email && (
            <div className="mt-1 text-xs text-rose-600">{errors.email}</div>
          )}
        </div>

        {/* Password (exactly 8) */}
        <div className="mb-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Password{" "}
            <span className="text-gray-400">(exactly 8 characters)</span>
          </label>
          <div className="relative">
            <input
              className="input w-full pr-24"
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              autoComplete="current-password"
              minLength={8}
              maxLength={8} // also guards copy-paste
              required
              placeholder="••••••••"
            />
            {/* counter */}
            <div className="pointer-events-none absolute inset-y-0 right-12 flex items-center text-xs text-gray-500">
              {password.length}/8
            </div>
            {/* toggle */}
            <button
              type="button"
              className="absolute right-2 inset-y-0 my-auto rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
              onClick={() => setShowPwd((v) => !v)}
              aria-label={showPwd ? "Hide password" : "Show password"}
            >
              {showPwd ? "Hide" : "Show"}
            </button>
          </div>
          {touched.password && errors.password && (
            <div className="mt-1 text-xs text-rose-600">{errors.password}</div>
          )}
          {capsOn && (
            <div className="mt-1 text-xs text-amber-600">Caps Lock is ON</div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4">
          <button
            className="btn btn-primary w-full items-center flex justify-center"
            type="submit"
            disabled={loading || invalid}
            title={invalid ? "Please fix the errors above" : "Sign in"}
          >
            {loading ? "Signing in…" : "Login"}
          </button>
          <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
            <Link to="/signup" className="text-brand-600 underline">
              Create account
            </Link>
            <span className="text-gray-400">•</span>
            <button
              type="button"
              className="underline hover:text-gray-800"
              onClick={() =>
                setErr(
                  "If you forgot your password, contact an admin to reset it."
                )
              }
            >
              Forgot password?
            </button>
          </div>
        </div>

       
      </form>
    </div>
  );
}
