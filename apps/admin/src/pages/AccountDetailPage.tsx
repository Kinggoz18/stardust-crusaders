import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { gameIdSchema, summarizeProgress } from "@stardust/schema";
import { api } from "../lib/api";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ErrorState, SkeletonList } from "../components/States";

export function AccountDetailPage() {
  const { id = "" } = useParams();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.account>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);

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

  if (error && !data) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!data) return <SkeletonList rows={4} />;

  const { account, progress } = data;

  async function doBlock() {
    setBusy(true);
    try {
      await api.ban(account.id, "studio policy");
      setConfirmBlock(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not block this player.");
      setConfirmBlock(false);
    } finally {
      setBusy(false);
    }
  }

  async function doRestore() {
    setBusy(true);
    try {
      await api.unban(account.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore access.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <p className="crumb">
          <Link to="/accounts">Players</Link>
        </p>
        <h1>Player profile</h1>
        <p>{account.email ?? account.deviceId}</p>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

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
        {account.bannedAt ? (
          <button type="button" disabled={busy} onClick={() => void doRestore()}>
            Restore access
          </button>
        ) : (
          <button
            type="button"
            className="danger"
            disabled={busy}
            onClick={() => setConfirmBlock(true)}
          >
            Block player
          </button>
        )}
      </div>

      <h2>Games</h2>
      <ul className="link-list">
        {progress.length === 0 ? <li>No game progress yet.</li> : null}
        {progress.map((g) => {
          const parsed = gameIdSchema.safeParse(g.gameId);
          if (!parsed.success) {
            return (
              <li key={g.gameId}>
                <Link to={`/accounts/${account.id}/games/${g.gameId}`}>Unknown game</Link>
              </li>
            );
          }
          const summary = summarizeProgress(parsed.data, g.document, g.revision);
          return (
            <li key={g.gameId}>
              <Link to={`/accounts/${account.id}/games/${g.gameId}`}>
                {summary.displayName}
                {summary.draft ? " (draft)" : ""}
              </Link>
            </li>
          );
        })}
      </ul>

      {confirmBlock ? (
        <ConfirmDialog
          title="Block this player?"
          body="They will not be able to play until you restore access."
          confirmLabel="Block player"
          danger
          pending={busy}
          onCancel={() => setConfirmBlock(false)}
          onConfirm={() => void doBlock()}
        />
      ) : null}
    </section>
  );
}
