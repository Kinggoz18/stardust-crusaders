import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { ErrorState, SkeletonList } from "../components/States";

type GameRow = {
  id: string;
  name: string;
  draft: boolean;
  summary: string;
};

export function GamesPage() {
  const [games, setGames] = useState<GameRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .games()
      .then((d) => setGames(d.games))
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <section className="page">
      <header className="page-header">
        <h1>Games</h1>
        <p>Titles in your studio catalogue.</p>
      </header>
      {error ? <ErrorState message={error} /> : null}
      {!error && !games ? <SkeletonList rows={3} /> : null}
      <ul className="game-list">
        {games?.map((g) => (
          <li key={g.id}>
            <div className="game-card-head">
              <h2>{g.name}</h2>
              <span className={`badge ${g.draft ? "draft" : "live"}`}>
                {g.draft ? "Draft" : "Live"}
              </span>
            </div>
            <p>{g.summary}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
