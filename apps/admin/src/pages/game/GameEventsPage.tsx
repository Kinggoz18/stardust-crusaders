import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { pct } from "../../lib/metrics-filters";
import { useGameId, useGameMetricsFilters } from "../../hooks/useGameDashboard";
import { GameFilters } from "../../components/game/GameFilters";
import { ChartPanel } from "../../components/metrics/ChartPanel";
import { IosLimitedLabel } from "../../components/IosLimitedLabel";
import { EmptyState, ErrorState, SkeletonList } from "../../components/States";

export function GameEventsPage() {
  const gameId = useGameId();
  const { filters, setFilters, query } = useGameMetricsFilters(gameId);
  const [data, setData] = useState<Awaited<ReturnType<typeof api.metricsQuality>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    // Quality is studio-wide today; still show it in-game as ingest health context.
    void api
      .metricsQuality(query)
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

  const empty = data && data.accepted === 0 && data.duplicates === 0 && data.rejected === 0;

  return (
    <div className="game-section">
      <h2 className="section-title">Events</h2>
      <p className="metrics-caption">
        How clean the event stream is. Opt-outs and rejects are counted without fingerprinting.{" "}
        <IosLimitedLabel detail="Consent opt-out is the only signal when a player declines analytics — we do not invent a tracking id." />
      </p>
      <GameFilters filters={filters} onChange={setFilters} />
      {error ? <ErrorState message={error} /> : null}
      {!error && !data ? <SkeletonList rows={3} /> : null}
      {empty ? (
        <EmptyState title="No ingest yet" body="Health numbers appear as events arrive." />
      ) : null}
      {data && !empty ? (
        <>
          <dl className="facts wide metrics-kpis" aria-label="Event health">
            <div>
              <dt>Accepted</dt>
              <dd>{data.accepted}</dd>
            </div>
            <div>
              <dt>Duplicates</dt>
              <dd>{data.duplicates}</dd>
            </div>
            <div>
              <dt>Rejected</dt>
              <dd>{data.rejected}</dd>
            </div>
            <div>
              <dt>Opt-outs</dt>
              <dd>{data.consentOptOuts}</dd>
            </div>
            <div>
              <dt>Dedupe rate</dt>
              <dd>{pct(data.dedupeRate)}</dd>
            </div>
          </dl>
          <ChartPanel
            title="Accepted per day"
            rows={data.series.map((s) => ({
              label: s.day,
              value: s.accepted,
              hint:
                s.duplicates || s.rejected
                  ? `· ${s.duplicates} dup · ${s.rejected} rej`
                  : undefined,
            }))}
          />
        </>
      ) : null}
    </div>
  );
}
