import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { ErrorState, SkeletonList } from "../components/States";

export function GamesPage() {
  const [games, setGames] = useState<Array<{ id: string; name: string }> | null>(null);
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
            <h2>{g.name}</h2>
            <p>Cloud save and wallet ready.</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
