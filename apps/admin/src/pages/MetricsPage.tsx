import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { EmptyState, ErrorState, SkeletonList } from "../components/States";

export function MetricsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.metrics>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .metrics()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  const max = data ? Math.max(data.newAccounts24h, data.dau, data.wau, 1) : 1;

  return (
    <section className="page">
      <header className="page-header">
        <h1>Trends</h1>
        <p>How players are showing up this week.</p>
      </header>
      {error ? <ErrorState message={error} /> : null}
      {!error && !data ? <SkeletonList rows={3} /> : null}
      {data && data.newAccounts24h === 0 && data.dau === 0 && data.wau === 0 ? (
        <EmptyState title="No traffic yet" body="Trends appear after players open a game." />
      ) : null}
      {data ? (
        <>
          <ul className="chart-list" aria-label="Player counts">
            <ChartBar label="New players (24h)" value={data.newAccounts24h} max={max} />
            <ChartBar label="Daily players" value={data.dau} max={max} />
            <ChartBar label="Weekly players" value={data.wau} max={max} />
          </ul>

          <h2 className="section-title">Return rates</h2>
          <dl className="facts wide">
            <RetentionCard label="Day 1 return" value={data.retention.d1} />
            <RetentionCard label="Day 7 return" value={data.retention.d7} />
          </dl>
        </>
      ) : null}
    </section>
  );
}

function ChartBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = Math.max(4, Math.round((value / max) * 100));
  return (
    <li className="chart-row">
      <div className="chart-label">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="chart-track" aria-hidden="true">
        <div className="chart-fill" style={{ width: `${width}%` }} />
      </div>
    </li>
  );
}

function RetentionCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {value == null ? (
          <span className="collecting">Collecting data</span>
        ) : (
          `${Math.round(value * 100)}%`
        )}
      </dd>
    </div>
  );
}
