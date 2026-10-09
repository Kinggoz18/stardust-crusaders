import { NavLink } from "react-router-dom";
import type { MetricsFilters } from "../../lib/metrics-filters";

const tabs = [
  { to: "/metrics", end: true, label: "Overview" },
  { to: "/metrics/retention", label: "Return" },
  { to: "/metrics/funnel", label: "Levels" },
  { to: "/metrics/difficulty", label: "Difficulty" },
  { to: "/metrics/economy", label: "Coins" },
  { to: "/metrics/ads", label: "Ads" },
  { to: "/metrics/quality", label: "Data health" },
];

export function MetricsChrome({
  title,
  blurb,
  filters,
  onChange,
  children,
}: {
  title: string;
  blurb: string;
  filters: MetricsFilters;
  onChange: (next: MetricsFilters) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="page metrics-page">
      <header className="page-header">
        <h1>{title}</h1>
        <p>{blurb}</p>
      </header>

      <nav className="metrics-tabs" aria-label="Trend views">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => (isActive ? "active" : undefined)}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      <form
        className="metrics-filters"
        onSubmit={(e) => e.preventDefault()}
        aria-label="Trend filters"
      >
        <label>
          Game
          <select
            value={filters.gameId}
            onChange={(e) => onChange({ ...filters, gameId: e.target.value })}
          >
            <option value="">All games</option>
            <option value="one-spark">One Spark</option>
            <option value="loom-rush">Loom Rush</option>
            <option value="borrowed-time">Borrowed Time</option>
          </select>
        </label>
        <label>
          Platform
          <select
            value={filters.platform}
            onChange={(e) => onChange({ ...filters, platform: e.target.value })}
          >
            <option value="">All platforms</option>
            <option value="android">Android</option>
            <option value="ios">iOS</option>
          </select>
        </label>
        <label>
          From
          <input
            type="date"
            value={filters.from}
            onChange={(e) => onChange({ ...filters, from: e.target.value })}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={filters.to}
            onChange={(e) => onChange({ ...filters, to: e.target.value })}
          />
        </label>
      </form>

      {children}
    </section>
  );
}
