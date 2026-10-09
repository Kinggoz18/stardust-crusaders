import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { pct } from "../../lib/metrics-filters";
import { useMetricsFilters } from "../../hooks/useMetricsFilters";
import { MetricsChrome } from "../../components/metrics/MetricsChrome";
import { EmptyState, ErrorState, SkeletonList } from "../../components/States";

export function MetricsRetentionPage() {
  const { filters, setFilters, query } = useMetricsFilters();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.metricsRetention>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"chart" | "table">("table");

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    void api
      .metricsRetention(query)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <MetricsChrome
      title="Return rates"
      blurb="Share of a day’s new players who came back later."
      filters={filters}
      onChange={setFilters}
    >
      {error ? <ErrorState message={error} /> : null}
      {!error && !data ? <SkeletonList rows={4} /> : null}
      {data && data.cohorts.length === 0 ? (
        <EmptyState title="No cohorts yet" body="Return rates fill in after the nightly rollup." />
      ) : null}
      {data && data.cohorts.length > 0 ? (
        <div className="metrics-panel">
          <div className="metrics-panel-head">
            <h2 className="section-title">Cohorts</h2>
            <div className="view-toggle" role="group" aria-label="Show cohorts as">
              <button
                type="button"
                className={mode === "chart" ? "active" : undefined}
                aria-pressed={mode === "chart"}
                onClick={() => setMode("chart")}
              >
                Chart
              </button>
              <button
                type="button"
                className={mode === "table" ? "active" : undefined}
                aria-pressed={mode === "table"}
                onClick={() => setMode("table")}
              >
                Table
              </button>
            </div>
          </div>

          {mode === "chart" ? (
            <ul className="chart-list" aria-label="Day 1 return by cohort">
              {data.cohorts.map((c) => {
                const v = c.d1 ?? 0;
                const width = Math.max(4, Math.round(v * 100));
                return (
                  <li key={c.cohortDay} className="chart-row">
                    <div className="chart-label">
                      <span>
                        {c.cohortDay} ({c.cohortSize})
                      </span>
                      <strong>{pct(c.d1)}</strong>
                    </div>
                    <div className="chart-track" aria-hidden="true">
                      <div className="chart-fill" style={{ width: `${width}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="table-wrap" tabIndex={0}>
              <table className="data-table">
                <caption className="sr-only">Retention cohorts</caption>
                <thead>
                  <tr>
                    <th scope="col">Cohort day</th>
                    <th scope="col">Players</th>
                    <th scope="col">Day 1</th>
                    <th scope="col">Day 7</th>
                    <th scope="col">Day 30</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cohorts.map((c) => (
                    <tr key={c.cohortDay}>
                      <th scope="row">{c.cohortDay}</th>
                      <td>{c.cohortSize}</td>
                      <td>{pct(c.d1)}</td>
                      <td>{pct(c.d7)}</td>
                      <td>{pct(c.d30)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </MetricsChrome>
  );
}
