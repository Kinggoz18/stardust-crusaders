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

  return (
    <section className="page">
      <header className="page-header">
        <h1>Trends</h1>
        <p>How players are showing up this week.</p>
      </header>
      {error ? <ErrorState message={error} /> : null}
      {!error && !data ? <SkeletonList rows={3} /> : null}
      {data && data.newAccounts24h === 0 && data.dau === 0 ? (
        <EmptyState title="No traffic yet" body="Trends appear after players open a game." />
      ) : null}
      {data ? (
        <dl className="facts wide">
          <div>
            <dt>New players (24h)</dt>
            <dd>{data.newAccounts24h}</dd>
          </div>
          <div>
            <dt>Daily players</dt>
            <dd>{data.dau}</dd>
          </div>
          <div>
            <dt>Weekly players</dt>
            <dd>{data.wau}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
