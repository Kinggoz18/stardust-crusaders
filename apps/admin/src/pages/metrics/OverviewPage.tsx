import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { pct } from "../../lib/metrics-filters";
import { useMetricsFilters } from "../../hooks/useMetricsFilters";
import { MetricsChrome } from "../../components/metrics/MetricsChrome";
import { ChartPanel } from "../../components/metrics/ChartPanel";
import { EmptyState, ErrorState, SkeletonList } from "../../components/States";

export function MetricsOverviewPage() {
  const { filters, setFilters, query } = useMetricsFilters();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.metricsOverview>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    void api
      .metricsOverview(query)
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

  const empty = data && data.dau === 0 && data.newAccounts === 0 && data.sessions === 0;

  return (
    <MetricsChrome
      title="Trends"
      blurb="How players are showing up across the studio."
      filters={filters}
      onChange={setFilters}
    >
      {error ? <ErrorState message={error} /> : null}
      {!error && !data ? <SkeletonList rows={4} /> : null}
      {empty ? (
        <EmptyState title="No traffic yet" body="Trends appear after players open a game." />
      ) : null}
      {data && !empty ? (
        <>
          <dl className="facts wide metrics-kpis" aria-label="Key numbers">
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
              <dt>Stickiness</dt>
              <dd>{pct(data.stickiness)}</dd>
            </div>
            <div>
              <dt>Sessions</dt>
              <dd>{data.sessions}</dd>
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
            caption="Players with at least one event that day."
            rows={data.series.map((s) => ({
              label: s.day,
              value: s.dau,
              hint: s.newAccounts ? `· ${s.newAccounts} new` : undefined,
            }))}
          />
        </>
      ) : null}
    </MetricsChrome>
  );
}
