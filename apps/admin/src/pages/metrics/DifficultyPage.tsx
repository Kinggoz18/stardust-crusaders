import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { pct } from "../../lib/metrics-filters";
import { useMetricsFilters } from "../../hooks/useMetricsFilters";
import { MetricsChrome } from "../../components/metrics/MetricsChrome";
import { EmptyState, ErrorState, SkeletonList } from "../../components/States";

export function MetricsDifficultyPage() {
  const { filters, setFilters, query } = useMetricsFilters();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.metricsDifficulty>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    if (!filters.gameId) return;
    void api
      .metricsDifficulty(query)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [query, filters.gameId]);

  return (
    <MetricsChrome
      title="Difficulty health"
      blurb="Win rate against the designed band for each level."
      filters={filters}
      onChange={setFilters}
    >
      {!filters.gameId ? (
        <EmptyState title="Pick a game" body="One Spark has seeded bands for levels 1–40." />
      ) : null}
      {filters.gameId && error ? <ErrorState message={error} /> : null}
      {filters.gameId && !error && !data ? <SkeletonList rows={4} /> : null}
      {filters.gameId && data && data.levels.length === 0 ? (
        <EmptyState title="No difficulty data yet" body="Play through levels to compare against the curve." />
      ) : null}
      {data && data.levels.length > 0 ? (
        <div className="table-wrap" tabIndex={0}>
          <table className="data-table">
            <caption className="sr-only">Difficulty curve</caption>
            <thead>
              <tr>
                <th scope="col">Level</th>
                <th scope="col">Starts</th>
                <th scope="col">Win rate</th>
                <th scope="col">Target band</th>
                <th scope="col">In band</th>
              </tr>
            </thead>
            <tbody>
              {data.levels.map((l) => (
                <tr key={l.level} className={l.inBand === false ? "row-warn" : undefined}>
                  <th scope="row">{l.level}</th>
                  <td>{l.starts}</td>
                  <td>{pct(l.winRate)}</td>
                  <td>
                    {l.bandMin == null || l.bandMax == null
                      ? "—"
                      : `${pct(l.bandMin)}–${pct(l.bandMax)}`}
                  </td>
                  <td>
                    {l.inBand == null ? "—" : l.inBand ? "Yes" : "Outside"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </MetricsChrome>
  );
}
