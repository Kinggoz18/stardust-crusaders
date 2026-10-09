import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useGameId, useGameMetricsFilters } from "../../hooks/useGameDashboard";
import { GameFilters } from "../../components/game/GameFilters";
import { ChartPanel } from "../../components/metrics/ChartPanel";
import { EmptyState, ErrorState, SkeletonList } from "../../components/States";

export function GameEconomyPage() {
  const gameId = useGameId();
  const { filters, setFilters, query } = useGameMetricsFilters(gameId);
  const [data, setData] = useState<Awaited<ReturnType<typeof api.metricsEconomy>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [query]);

  const empty =
    data &&
    data.hintsCoins === 0 &&
    data.hintsAds === 0 &&
    data.coinIn === 0 &&
    data.coinOut === 0;

  return (
    <div className="game-section">
      <h2 className="section-title">Coins</h2>
      <p className="metrics-caption">Sources, sinks and balances for this game.</p>
      <GameFilters filters={filters} onChange={setFilters} />
      {error ? <ErrorState message={error} /> : null}
      {!error && !data ? <SkeletonList rows={3} /> : null}
      {empty ? (
        <EmptyState title="No economy activity" body="Coin rows appear after play." />
      ) : null}
      {data && !empty ? (
        <>
          <dl className="facts wide metrics-kpis" aria-label="Economy totals">
            <div>
              <dt>Hints (coins)</dt>
              <dd>{data.hintsCoins}</dd>
            </div>
            <div>
              <dt>Hints (ads)</dt>
              <dd>{data.hintsAds}</dd>
            </div>
            <div>
              <dt>Coins in</dt>
              <dd>{data.coinIn}</dd>
            </div>
            <div>
              <dt>Coins out</dt>
              <dd>{data.coinOut}</dd>
            </div>
          </dl>
          <ChartPanel
            title="Balance buckets"
            rows={data.balanceBuckets.map((b) => ({ label: b.bucket, value: b.accounts }))}
          />
          <ChartPanel
            title="By reason"
            rows={data.byReason.map((r) => ({
              label: r.reason,
              value: Math.abs(r.deltaSum),
              hint: r.deltaSum < 0 ? "out" : "in",
            }))}
          />
        </>
      ) : null}
    </div>
  );
}
