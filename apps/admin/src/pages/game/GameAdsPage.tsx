import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../../lib/api";
import { num, pct } from "../../lib/metrics-filters";
import { useAuth } from "../../lib/auth";
import { gamePath, roleAtLeast } from "../../lib/games";
import { useGameId, useGameMetricsFilters } from "../../hooks/useGameDashboard";
import { GameFilters } from "../../components/game/GameFilters";
import { IosLimitedLabel } from "../../components/IosLimitedLabel";
import { EmptyState, ErrorState, SkeletonList } from "../../components/States";

export function GameAdsPage() {
  const gameId = useGameId();
  const auth = useAuth();
  const { filters, setFilters, query } = useGameMetricsFilters(gameId);
  const [data, setData] = useState<Awaited<ReturnType<typeof api.metricsAds>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roleAtLeast(auth.role, "support")) return;
    let cancelled = false;
    setData(null);
    setError(null);
    void api
      .metricsAds(query)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [query, auth.role]);

  if (!roleAtLeast(auth.role, "support")) {
    return <Navigate to={gamePath(gameId)} replace />;
  }

  const empty =
    data &&
    data.rewardedOffers === 0 &&
    data.rewardedStarts === 0 &&
    data.interstitialImpressions === 0 &&
    data.iapPurchasers === 0;

  return (
    <div className="game-section">
      <h2 className="section-title">Ads & purchases</h2>
      <p className="metrics-caption">
        Rewarded ads, interstitials and store purchases for this game.{" "}
        <IosLimitedLabel detail="Ad revenue per player waits on network reports and is limited without tracking permission on iOS." />
      </p>
      <GameFilters filters={filters} onChange={setFilters} />
      {error ? <ErrorState message={error} /> : null}
      {!error && !data ? <SkeletonList rows={3} /> : null}
      {empty ? (
        <EmptyState
          title="No ad or purchase activity"
          body="These numbers fill in from events and store webhooks."
        />
      ) : null}
      {data && !empty ? (
        <dl className="facts wide metrics-kpis" aria-label="Ads and revenue">
          <div>
            <dt>Rewarded offers</dt>
            <dd>{data.rewardedOffers}</dd>
          </div>
          <div>
            <dt>Rewarded starts</dt>
            <dd>{data.rewardedStarts}</dd>
          </div>
          <div>
            <dt>Completions</dt>
            <dd>{data.rewardedCompletions}</dd>
          </div>
          <div>
            <dt>Completion rate</dt>
            <dd>{pct(data.completionRate)}</dd>
          </div>
          <div>
            <dt>Rewards granted</dt>
            <dd>{data.rewardsGranted}</dd>
          </div>
          <div>
            <dt>Interstitials / session</dt>
            <dd>{num(data.interstitialPerSession)}</dd>
          </div>
          <div>
            <dt>
              Ad revenue / player <IosLimitedLabel />
            </dt>
            <dd>
              {data.arpdauPending ? (
                <span className="collecting">Waiting on ad network reports</span>
              ) : (
                num(data.arpdau)
              )}
            </dd>
          </div>
          <div>
            <dt>Buyers</dt>
            <dd>{data.iapPurchasers}</dd>
          </div>
          <div>
            <dt>Purchase revenue</dt>
            <dd>{(data.iapRevenueCents / 100).toFixed(2)}</dd>
          </div>
          <div>
            <dt>Buyer share</dt>
            <dd>{pct(data.payerShare)}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
