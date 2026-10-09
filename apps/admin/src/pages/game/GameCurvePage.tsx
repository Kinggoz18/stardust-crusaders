import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../../lib/api";
import { pct } from "../../lib/metrics-filters";
import { useGameId, useGameMetricsFilters } from "../../hooks/useGameDashboard";
import { gamePath } from "../../lib/games";
import { GameFilters } from "../../components/game/GameFilters";
import { EmptyState, ErrorState, SkeletonList } from "../../components/States";

export function GameCurvePage() {
  const gameId = useGameId();
  const { filters, setFilters, query } = useGameMetricsFilters(gameId);
  const [data, setData] = useState<Awaited<ReturnType<typeof api.metricsDifficulty>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (gameId !== "one-spark") return;
    let cancelled = false;
    setData(null);
    setError(null);
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
  }, [query, gameId]);

  if (gameId !== "one-spark") {
    return <Navigate to={gamePath(gameId)} replace />;
  }

  return (
    <div className="game-section">
      <h2 className="section-title">Level curve</h2>
      <p className="metrics-caption">
        Win rate against the designed band for One Spark levels (including 28+).
      </p>
      <GameFilters filters={filters} onChange={setFilters} />
      {error ? <ErrorState message={error} /> : null}
      {!error && !data ? <SkeletonList rows={4} /> : null}
      {data && data.levels.length === 0 ? (
        <EmptyState
          title="No difficulty data yet"
          body="Play through levels to compare against the curve."
        />
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
                  <td>{l.inBand == null ? "—" : l.inBand ? "Yes" : "Outside"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
