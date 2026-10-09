import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { pct } from "../lib/metrics-filters";
import { defaultMetricsFilters, filtersToQuery } from "../lib/metrics-filters";
import { ChartPanel } from "../components/metrics/ChartPanel";
import { IosLimitedLabel } from "../components/IosLimitedLabel";
import { EmptyState, ErrorState, SkeletonList } from "../components/States";

/** Thin studio-wide Trends — per-game detail lives under /games/:game. */
export function MetricsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.metricsOverview>> | null>(null);
  const [quality, setQuality] = useState<Awaited<ReturnType<typeof api.metricsQuality>> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = filtersToQuery({ ...defaultMetricsFilters(), gameId: "", platform: "" });
    void Promise.all([api.metricsOverview(q), api.metricsQuality(q)])
      .then(([m, qy]) => {
        setData(m);
        setQuality(qy);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const empty = data && data.dau === 0 && data.newAccounts === 0 && data.sessions === 0;

  return (
    <section className="page metrics-page">
      <header className="page-header">
        <h1>Trends</h1>
        <p>
          Studio-wide headlines only. Open a{" "}
          <Link className="text-link" to="/games">
            game dashboard
          </Link>{" "}
          for levels, coins and ads.
        </p>
      </header>

      {error ? <ErrorState message={error} /> : null}
      {!error && !data ? <SkeletonList rows={3} /> : null}
      {empty ? (
        <EmptyState title="No traffic yet" body="Trends appear after players open a game." />
      ) : null}

      {data && !empty ? (
        <>
          <p className="metrics-caption">
            First-party ids only — no advertising identifier. <IosLimitedLabel />
          </p>
          <dl className="facts wide metrics-kpis" aria-label="Studio key numbers">
            <div>
              <dt>New players</dt>
              <dd>{data.newAccounts}</dd>
            </div>
            <div>
              <dt>Daily players</dt>
              <dd>{data.dau}</dd>
            </div>
            <div>
              <dt>Weekly players</dt>
              <dd>{data.wau}</dd>
            </div>
            <div>
              <dt>Monthly players</dt>
              <dd>{data.mau}</dd>
            </div>
            <div>
              <dt>Day 1 return</dt>
              <dd>{pct(data.retention.d1)}</dd>
            </div>
            <div>
              <dt>Day 7 return</dt>
              <dd>{pct(data.retention.d7)}</dd>
            </div>
            <div>
              <dt>Day 30 return</dt>
              <dd>{pct(data.retention.d30)}</dd>
            </div>
          </dl>
          <ChartPanel
            title="Daily players"
            rows={data.series.map((s) => ({
              label: s.day,
              value: s.dau,
              hint: s.newAccounts ? `· ${s.newAccounts} new` : undefined,
            }))}
          />
        </>
      ) : null}

      {quality && quality.accepted + quality.duplicates + quality.rejected > 0 ? (
        <dl className="facts wide metrics-kpis" aria-label="Data health">
          <div>
            <dt>Events accepted</dt>
            <dd>{quality.accepted}</dd>
          </div>
          <div>
            <dt>Opt-outs</dt>
            <dd>{quality.consentOptOuts}</dd>
          </div>
          <div>
            <dt>Dedupe rate</dt>
            <dd>{pct(quality.dedupeRate)}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
