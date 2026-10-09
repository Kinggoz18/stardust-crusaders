import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useGameId, useGameMetricsFilters } from "../../hooks/useGameDashboard";
import { gamePath } from "../../lib/games";
import { GameFilters } from "../../components/game/GameFilters";
import { ChartPanel } from "../../components/metrics/ChartPanel";
import { EmptyState, ErrorState, SkeletonList } from "../../components/States";

export function GameHintsPage() {
  const gameId = useGameId();
  const { filters, setFilters, query } = useGameMetricsFilters(gameId);
  const [data, setData] = useState<Awaited<ReturnType<typeof api.metricsEconomy>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (gameId !== "one-spark") return;
    let cancelled = false;
    setData(null);
    setError(null);
    void api
      .metricsEconomy(query)
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

  const empty = data && data.hintsCoins === 0 && data.hintsAds === 0;

  return (
    <div className="game-section">
      <h2 className="section-title">Hints</h2>
      <p className="metrics-caption">How One Spark players pay for hints — coins versus ads.</p>
      <GameFilters filters={filters} onChange={setFilters} />
      {error ? <ErrorState message={error} /> : null}
      {!error && !data ? <SkeletonList rows={2} /> : null}
      {empty ? (
        <EmptyState title="No hints used yet" body="Hint usage appears after players spend coins or watch ads." />
      ) : null}
      {data && !empty ? (
        <ChartPanel
          title="Hint source"
          rows={[
            { label: "Coins", value: data.hintsCoins },
            { label: "Ads", value: data.hintsAds },
          ]}
        />
      ) : null}
    </div>
  );
}
