import { NavLink, Outlet } from "react-router-dom";
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

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Stardust Crusaders</span>
        </div>
        <nav aria-label="Studio">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? "active" : undefined)}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          className="ghost"
          onClick={async () => {
            try {
              await api.logout();
            } finally {
              auth.setRole(null);
              window.location.href = "/login";
            }
          }}
        >
          Sign out
        </button>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
