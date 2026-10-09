import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../../lib/api";
import { num } from "../../lib/metrics-filters";
import { useGameId, useGameMetricsFilters } from "../../hooks/useGameDashboard";
import { gamePath } from "../../lib/games";
import { GameFilters } from "../../components/game/GameFilters";
import { ChartPanel } from "../../components/metrics/ChartPanel";
import { EmptyState, ErrorState, SkeletonList } from "../../components/States";

export function GameIslandPage() {
  const gameId = useGameId();
  const { filters, setFilters, query } = useGameMetricsFilters(gameId);
  const [data, setData] = useState<Awaited<ReturnType<typeof api.metricsBorrowedTime>> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (gameId !== "borrowed-time") return;
    let cancelled = false;
    setData(null);
    setError(null);
    void api
      .metricsBorrowedTime(query)
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

  if (gameId !== "borrowed-time") {
    return <Navigate to={gamePath(gameId)} replace />;
  }

  const empty = data && data.eras.length === 0 && data.buildingsPlaced === 0 && data.sessions === 0;

  return (
    <div className="game-section">
      <h2 className="section-title">Eras & debt</h2>
      <p className="metrics-caption">
        How far island players have reached, buildings placed, and session pacing.
      </p>
      <GameFilters filters={filters} onChange={setFilters} />
      {error ? <ErrorState message={error} /> : null}
      {!error && !data ? <SkeletonList rows={3} /> : null}
      {empty ? (
        <EmptyState title="No island activity yet" body="Era and debt rows appear after play." />
      ) : null}
      {data && !empty ? (
        <>
          <dl className="facts wide metrics-kpis" aria-label="Island pacing">
            <div>
              <dt>Sessions</dt>
              <dd>{data.sessions}</dd>
            </div>
            <div>
              <dt>Avg session (sec)</dt>
              <dd>{num(data.avgSessionSec)}</dd>
            </div>
            <div>
              <dt>Buildings placed</dt>
              <dd>{data.buildingsPlaced}</dd>
            </div>
          </dl>
          <ChartPanel
            title="Era reached"
            rows={data.eras.map((e) => ({
              label: e.era,
              value: e.reachers,
              hint:
                e.avgDebt != null || e.avgBuildings != null
                  ? `· debt ${num(e.avgDebt)} · buildings ${num(e.avgBuildings)}`
                  : undefined,
            }))}
          />
        </>
      ) : null}
    </div>
  );
}
