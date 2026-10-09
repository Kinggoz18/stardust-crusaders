import type { MetricsFilters } from "../../lib/metrics-filters";

/** Platform + date range only (game is fixed by the dashboard). */
export function GameFilters({
  filters,
  onChange,
}: {
  filters: MetricsFilters;
  onChange: (next: MetricsFilters) => void;
}) {
  return (
    <form className="metrics-filters" onSubmit={(e) => e.preventDefault()} aria-label="Filters">
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
  );
}
