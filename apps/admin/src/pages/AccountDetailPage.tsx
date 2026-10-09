import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { gameIdSchema, summarizeProgress } from "@stardust/schema";
import { api } from "../lib/api";
import { ErrorState, SkeletonList } from "../components/States";

export function AccountDetailPage() {
  const { id = "" } = useParams();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.account>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setError(null);
    setData(null);
    try {
      setData(await api.account(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load player.");
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!data) return <SkeletonList rows={4} />;

  const { account, progress } = data;

  return (
    <section className="page">
      <header className="page-header">
        <p className="crumb">
          <Link to="/accounts">Players</Link>
        </p>
        <h1>Player profile</h1>
        <p>{account.email ?? account.deviceId}</p>
      </header>

      <dl className="facts">
        <div>
          <dt>Platform</dt>
          <dd>{account.platform}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{account.bannedAt ? "Blocked" : "Active"}</dd>
        </div>
        <div>
          <dt>Joined</dt>
          <dd>{new Date(account.createdAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</dd>
        </div>
      </dl>

      <div className="actions">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              if (account.bannedAt) await api.unban(account.id);
              else await api.ban(account.id, "studio policy");
              await load();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Update failed.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {account.bannedAt ? "Restore access" : "Block player"}
        </button>
      </div>

      <h2>Games</h2>
      <ul className="link-list">
        {progress.length === 0 ? <li>No game progress yet.</li> : null}
        {progress.map((g) => {
          const parsed = gameIdSchema.safeParse(g.gameId);
          if (!parsed.success) {
            return (
              <li key={g.gameId}>
                <Link to={`/accounts/${account.id}/games/${g.gameId}`}>{g.gameId}</Link>
              </li>
            );
          }
          const summary = summarizeProgress(parsed.data, g.document, g.revision);
          const headline = summary.rows[0];
          return (
            <li key={g.gameId}>
              <Link to={`/accounts/${account.id}/games/${g.gameId}`}>
                {summary.displayName}
                {summary.draft ? " (draft)" : ""}
                {headline ? ` · ${headline.label} ${headline.value}` : ""}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
