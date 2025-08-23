import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore.js";

export default function Navbar() {
  const { user, logout, isAdmin, isSuperAdmin } = useAuthStore();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const scrollYRef = useRef(0);

  const panelRef = useRef(null);
  const closeBtnRef = useRef(null);
  const lastFocusedRef = useRef(null);

  const onLogout = () => {
    logout();
    nav("/login");
  };
  const close = () => setOpen(false);

  // Close mobile menu on route change
  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);

  // ESC closes the menu
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // BODY SCROLL LOCK + focus management
  useEffect(() => {
    if (!open) return;

    // Save current scroll position
    scrollYRef.current = window.scrollY || document.documentElement.scrollTop;

    // Lock the page (iOS/Safari-safe)
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

    // focus management
    lastFocusedRef.current = document.activeElement;
    setTimeout(() => closeBtnRef.current?.focus(), 0);

    return () => {
      // restore styles
      html.style.overflow = prev.htmlOverflow || "";
      body.style.overflow = prev.bodyOverflow || "";
      body.style.position = prev.bodyPosition || "";
      body.style.top = prev.bodyTop || "";
      body.style.width = prev.bodyWidth || "";

      // restore scroll position
      window.scrollTo(0, scrollYRef.current);

      // restore focus
      try {
        lastFocusedRef.current?.focus?.();
      } catch {}
    };
  }, [open]);

  // Simple focus trap inside the panel
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
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const Item = ({ to, children, className = "" }) => (
    <Link
      to={to}
      className={`btn btn-ghost w-full justify-start md:w-auto ${className}`}
      onClick={close}
    >
      {children}
    </Link>
  );

  return (
    <div className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-brand-600" />
          <span className="text-lg font-semibold">YourCompany</span>
        </Link>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-2">
          {(isAdmin() || isSuperAdmin()) && <Item to="/users">Users</Item>}
          {isAdmin() && <Item to="/add-user">Add User</Item>}
          {isSuperAdmin() && <Item to="/superadmin">High Power</Item>}
          <Item to="/profile">{user?.name ?? "Profile"}</Item>
          <button onClick={onLogout} className="btn btn-primary">
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
                <div className="h-8 w-8 rounded-lg bg-brand-600" />
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
              <div className="text-xs text-gray-500 break-all">
                {user?.email}
              </div>
            </div>

            {/* links */}
            <div className="p-3 flex flex-col gap-2">
              <Item to="/">Home</Item>
              {(isAdmin() || isSuperAdmin()) && <Item to="/users">Users</Item>}
              {isAdmin() && <Item to="/add-user">Add User</Item>}
              {isSuperAdmin() && <Item to="/superadmin">High Power</Item>}
              <Item to="/profile">Profile</Item>
              <button
                onClick={() => {
                  close();
                  onLogout();
                }}
                className="btn btn-primary w-full mt-1"
              >
                Logout
              </button>
            </div>

            {/* little brand footer */}
            <div className="mt-auto px-4 py-3 text-xs text-gray-500 border-t">
              © {new Date().getFullYear()} YourCompany
            </div>
          </div>

          {/* slide-in keyframes */}
          <style>{`
            @keyframes slideIn {
              from { transform: translateX(100%); opacity: 0.6; }
              to   { transform: translateX(0%);   opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
