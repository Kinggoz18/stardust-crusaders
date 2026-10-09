import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useGameId, useGameMetricsFilters } from "../../hooks/useGameDashboard";
import { GameFilters } from "../../components/game/GameFilters";
import { ChartPanel } from "../../components/metrics/ChartPanel";
import { EmptyState, ErrorState, SkeletonList } from "../../components/States";

export function GameLevelsPage() {
  const gameId = useGameId();
  const { filters, setFilters, query } = useGameMetricsFilters(gameId);
  const [data, setData] = useState<Awaited<ReturnType<typeof api.metricsFunnel>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    void api
      .metricsFunnel(query)
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
    <div className="game-section">
      <h2 className="section-title">Levels</h2>
      <p className="metrics-caption">Starts, wins, fails and quits for each level.</p>
      <GameFilters filters={filters} onChange={setFilters} />
      {error ? <ErrorState message={error} /> : null}
      {!error && !data ? <SkeletonList rows={4} /> : null}
      {data && data.levels.length === 0 ? (
        <EmptyState title="No level play yet" body="Funnel rows appear after level events roll up." />
      ) : null}
      {data && data.levels.length > 0 ? (
        <>
          <ChartPanel
            title="Starts by level"
            rows={data.levels.map((l) => ({
              label: `Level ${l.level}`,
              value: l.starts,
              hint: `· ${l.wins} win · ${l.fails} fail · ${l.quits} quit`,
            }))}
          />
          <div className="table-wrap" tabIndex={0}>
            <table className="data-table">
              <caption className="sr-only">Level funnel detail</caption>
              <thead>
                <tr>
                  <th scope="col">Level</th>
                  <th scope="col">Starts</th>
                  <th scope="col">Wins</th>
                  <th scope="col">Fails</th>
                  <th scope="col">Quits</th>
                  <th scope="col">Avg moves left</th>
                  <th scope="col">Stars 0–3</th>
                </tr>
              </thead>
              <tbody>
                {data.levels.map((l) => (
                  <tr key={l.level}>
                    <th scope="row">{l.level}</th>
                    <td>{l.starts}</td>
                    <td>{l.wins}</td>
                    <td>{l.fails}</td>
                    <td>{l.quits}</td>
                    <td>{l.avgMovesLeft == null ? "—" : l.avgMovesLeft.toFixed(1)}</td>
                    <td>
                      {l.stars.s0}/{l.stars.s1}/{l.stars.s2}/{l.stars.s3}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
