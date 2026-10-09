import { useEffect, useId, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";

const links = [
  { to: "/accounts", label: "Players" },
  { to: "/games", label: "Games" },
  { to: "/metrics", label: "Trends" },
  { to: "/audit", label: "Activity" },
  { to: "/settings/staff", label: "Staff" },
];

export function Shell() {
  const auth = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const first = panelRef.current?.querySelector<HTMLElement>("a, button");
    first?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function signOut() {
    try {
      await api.logout();
    } finally {
      auth.setRole(null);
      window.location.href = "/login";
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Stardust Crusaders</span>
        </div>

        <button
          ref={buttonRef}
          type="button"
          className="ghost menu-toggle"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
        >
          Menu
        </button>

        <nav className="nav-desktop" aria-label="Studio">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? "active" : undefined)}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <button type="button" className="ghost sign-out-desktop" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>

      {open ? (
        <div
          className="nav-backdrop"
          onClick={() => {
            setOpen(false);
            buttonRef.current?.focus();
          }}
        />
      ) : null}

      <div
        ref={panelRef}
        id={menuId}
        className={`nav-drawer${open ? " open" : ""}`}
        hidden={!open}
        role="dialog"
        aria-modal="true"
        aria-label="Studio menu"
      >
        <nav aria-label="Studio">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? "active" : undefined)}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <button type="button" className="ghost" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
