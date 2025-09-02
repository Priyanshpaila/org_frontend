import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore.js";

const BRAND_NAME = "RR ISPAT";
const BRAND_SRC = "/logo.png";

function BrandLogo({ src = BRAND_SRC, name = BRAND_NAME, sizeClass = "h-10 w-15" }) {
  const [error, setError] = useState(false);
  if (!error && src) {
    return (
      <img
        src={src}
        alt={`${name} logo`}
        className={`${sizeClass} rounded-lg object-contain`}
        onError={() => setError(true)}
        width={110}
        height={110}
        draggable={false}
      />
    );
  }
  return (
    <div
      className={`${sizeClass} rounded-lg bg-brand-600 text-white flex items-center justify-center font-semibold select-none`}
      aria-label={name}
    >
      {String(name || "?").charAt(0).toUpperCase()}
    </div>
  );
}

const VARIANT_CLASSES = {
  ghost: "btn-ghost",
  neutral: "bg-gray-100 text-gray-800 hover:bg-gray-200",
  info: "bg-blue-600 text-white hover:bg-blue-700",
  brand: "bg-indigo-600 text-white hover:bg-indigo-700",
  success: "bg-green-600 text-white hover:bg-green-700",
  warning: "bg-amber-500 text-white hover:bg-amber-600",
  primary: "bg-slate-600 text-white hover:bg-slate-700",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

function Item({ to, children, variant = "ghost", className = "", onClick }) {
  const v = VARIANT_CLASSES[variant] || VARIANT_CLASSES.ghost;
  return (
    <Link
      to={to}
      className={`btn w-full justify-start md:w-auto ${v} ${className}`}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}

export default function Navbar() {
  const { user, logout, isAdmin, isSuperAdmin } = useAuthStore();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const scrollYRef = useRef(0);

  const panelRef = useRef(null);
  const closeBtnRef = useRef(null);
  const lastFocusedRef = useRef(null);

  const close = () => setOpen(false);
  const onLogout = () => { logout(); nav("/login"); };

  useEffect(() => { setOpen(false); }, [loc.pathname]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // BODY SCROLL LOCK + focus management
  useEffect(() => {
    if (!open) return;

    scrollYRef.current = window.scrollY || document.documentElement.scrollTop;

    const html = document.documentElement;
    const body = document.body;

    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
    };

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollYRef.current}px`;
    body.style.width = "100%";

    lastFocusedRef.current = document.activeElement;
    setTimeout(() => closeBtnRef.current?.focus(), 0);

    return () => {
      html.style.overflow = prev.htmlOverflow || "";
      body.style.overflow = prev.bodyOverflow || "";
      body.style.position = prev.bodyPosition || "";
      body.style.top = prev.bodyTop || "";
      body.style.width = prev.bodyWidth || "";
      window.scrollTo(0, scrollYRef.current);
      try { lastFocusedRef.current?.focus?.(); } catch {}
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key !== "Tab") return;
      const root = panelRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const canSeeAdminArea = isAdmin() || isSuperAdmin();

  return (
    <>
      {/* 
        FIX: header is fixed on mobile, sticky on desktop.
        This prevents it from "scrolling away" when the page is
        at the bottom and the drawer opens.
      */}
      <div className="z-30 border-b bg-white/80 backdrop-blur fixed top-0 left-0 right-0 md:sticky md:top-0">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo />
          </Link>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-2">
            {canSeeAdminArea && <Item to="/users" variant="info">Users</Item>}
            {canSeeAdminArea && (
              <Item to="/special-referrals" variant="brand">Special Referral</Item>
            )}
            {isAdmin() && <Item to="/add-user" variant="success">Add User</Item>}
            {isSuperAdmin() && <Item to="/superadmin" variant="warning">Meta Access</Item>}
            <Item to="/profile" variant="neutral">{user?.name ?? "Profile"}</Item>
            <button
              onClick={onLogout}
              className={`btn ${VARIANT_CLASSES.danger}`}
              title="Sign out"
            >
              Logout
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden btn btn-ghost"
            aria-label="Open menu"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-drawer"
          >
            ☰
          </button>
        </div>

        {/* Mobile menu (overlay + panel) */}
        {open && (
          <div className="md:hidden">
            {/* overlay */}
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
              onClick={close}
              aria-hidden="true"
            />

            {/* panel */}
            <div
              id="mobile-drawer"
              role="dialog"
              aria-modal="true"
              ref={panelRef}
              className="
                fixed right-0 top-0 z-50
                h-svh w-[86vw] max-w-xs
                bg-white shadow-2xl border-l
                flex flex-col
                overflow-y-auto overscroll-contain
                animate-[slideIn_.2s_ease-out]
              "
              style={{ animationName: "slideIn" }}
            >
              {/* header in panel */}
              <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white/90 backdrop-blur">
                <div className="flex items-center gap-2">
                  {/* <BrandLogo /> */}
                  <span className="font-semibold">Menu</span>
                </div>
                <button
                  ref={closeBtnRef}
                  className="btn btn-ghost"
                  aria-label="Close menu"
                  onClick={close}
                >
                  ✕
                </button>
              </div>

              {/* user summary */}
              <div className="px-4 py-3 border-b">
                <div className="text-sm text-gray-600">Signed in as</div>
                <div className="font-medium">{user?.name ?? "User"}</div>
                <div className="text-xs text-gray-500 break-all">{user?.email}</div>
              </div>

              {/* links */}
              <div className="p-3 flex flex-col gap-2">
                <Item to="/" onClick={close}>Home</Item>
                {canSeeAdminArea && (
                  <Item to="/users" onClick={close} variant="info">Users</Item>
                )}
                {canSeeAdminArea && (
                  <Item to="/special-referrals" onClick={close} variant="brand">
                    Special Referral
                  </Item>
                )}
                {isAdmin() && (
                  <Item to="/add-user" onClick={close} variant="success">Add User</Item>
                )}
                {isSuperAdmin() && (
                  <Item to="/superadmin" onClick={close} variant="warning">Meta Access</Item>
                )}
                <Item to="/profile" onClick={close} variant="neutral">Profile</Item>
                <button
                  onClick={() => { close(); onLogout(); }}
                  className={`btn w-full mt-1 ${VARIANT_CLASSES.danger}`}
                >
                  Logout
                </button>
              </div>

              {/* little brand footer */}
              <div className="mt-auto px-4 py-3 text-xs text-gray-500 border-t">
                © {new Date().getFullYear()} {BRAND_NAME}
              </div>
            </div>

            <style>{`
              @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0.6; }
                to   { transform: translateX(0%);   opacity: 1; }
              }
            `}</style>
          </div>
        )}
      </div>

      {/* Spacer so content isn't hidden under the fixed bar on mobile */}
      <div className="h-[60px] md:h-0" />
    </>
  );
}
