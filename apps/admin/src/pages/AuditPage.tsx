import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { EmptyState, ErrorState, SkeletonList } from "../components/States";

const ACTION_LABELS: Record<string, string> = {
  read_account: "Viewed a player",
  search_accounts: "Searched players",
  read_progress: "Viewed progress",
  read_wallet: "Viewed wallet",
  read_events: "Viewed events",
  ban: "Blocked a player",
  unban: "Restored a player",
  reset_progress: "Reset progress",
  staff_create: "Invited staff",
  staff_invite: "Invited staff",
  staff_invite_revoke: "Revoked an invite",
  staff_invite_accept: "Joined via invite",
  staff_update: "Updated staff",
  bootstrap: "Set up the studio",
  bootstrap_denied: "Blocked a setup try",
  login: "Signed in",
  logout: "Signed out",
};

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
        <EmptyState
          title="Quiet so far"
          body="When someone looks up a player or changes access, it will show here."
        />
      ) : null}
      {entries && entries.length > 0 ? (
        <ul className="activity-list">
          {entries.map((e) => (
            <li key={e.id} className="activity-item">
              <p className="activity-title">{ACTION_LABELS[e.action] ?? e.action.replaceAll("_", " ")}</p>
              <p className="activity-meta">
                {new Date(e.createdAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}
                {" · "}
                {e.targetType === "account" ? "Player" : e.targetType === "staff" ? "Staff" : e.targetType}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
