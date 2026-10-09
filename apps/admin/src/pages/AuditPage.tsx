import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { EmptyState, ErrorState, SkeletonList } from "../components/States";

export function AuditPage() {
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof api.audit>>["entries"] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .audit()
      .then((d) => setEntries(d.entries))
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <section className="page">
      <header className="page-header">
        <h1>Activity</h1>
        <p>Staff actions on player data.</p>
      </header>
      {error ? <ErrorState message={error} /> : null}
      {!error && !entries ? <SkeletonList /> : null}
      {entries && entries.length === 0 ? (
        <EmptyState title="No activity yet" body="Reads and changes by staff show up here." />
      ) : null}
      {entries && entries.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Action</th>
              <th scope="col">Target</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.createdAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</td>
                <td>{e.action.replaceAll("_", " ")}</td>
                <td>{e.targetType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
