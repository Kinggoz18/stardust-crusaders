import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useGameId } from "../../hooks/useGameDashboard";
import { GAME_LABELS } from "../../lib/games";
import { EmptyState, ErrorState, SkeletonList } from "../../components/States";

type Row = {
  id: string;
  deviceId: string;
  email: string | null;
  platform: string;
  bannedAt: string | null;
  createdAt: string;
};

export function GamePlayersPage() {
  const gameId = useGameId();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    void api
      .gamePlayers(gameId)
      .then((d) => {
        if (!cancelled) setRows(d.accounts);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  return (
    <div className="game-section">
      <h2 className="section-title">Players</h2>
      <p className="metrics-caption">
        Accounts with save data in {GAME_LABELS[gameId]}. Search all players from the studio Players
        page.
      </p>
      {error ? <ErrorState message={error} /> : null}
      {!error && !rows ? <SkeletonList rows={4} /> : null}
      {rows && rows.length === 0 ? (
        <EmptyState
          title="No players for this game yet"
          body="Players appear here after their first save for this title."
        />
      ) : null}
      {rows && rows.length > 0 ? (
        <div className="table-wrap" tabIndex={0}>
          <table className="data-table">
            <caption className="sr-only">Players in {GAME_LABELS[gameId]}</caption>
            <thead>
              <tr>
                <th scope="col">Device</th>
                <th scope="col">Platform</th>
                <th scope="col">Joined</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row">
                    <Link to={`/accounts/${r.id}`}>{r.deviceId}</Link>
                  </th>
                  <td>{r.platform}</td>
                  <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td>{r.bannedAt ? "Blocked" : "Active"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
