import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { pct } from "../../lib/metrics-filters";
import { useMetricsFilters } from "../../hooks/useMetricsFilters";
import { MetricsChrome } from "../../components/metrics/MetricsChrome";
import { ChartPanel } from "../../components/metrics/ChartPanel";
import { EmptyState, ErrorState, SkeletonList } from "../../components/States";

export function MetricsQualityPage() {
  const { filters, setFilters, query } = useMetricsFilters();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.metricsQuality>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
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
    <MetricsChrome
      title="Data health"
      blurb="How clean the event stream is — accepts, duplicates, rejects, and opt-outs."
      filters={filters}
      onChange={setFilters}
    >
      {error ? <ErrorState message={error} /> : null}
      {!error && !data ? <SkeletonList rows={3} /> : null}
      {empty ? (
        <EmptyState title="No ingest yet" body="Health numbers appear as events arrive." />
      ) : null}
      {data && !empty ? (
        <>
          <dl className="facts wide metrics-kpis" aria-label="Data quality">
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
    </MetricsChrome>
  );
}
