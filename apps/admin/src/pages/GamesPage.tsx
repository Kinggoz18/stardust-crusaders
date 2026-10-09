import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { pct } from "../lib/metrics-filters";
import { defaultMetricsFilters, filtersToQuery } from "../lib/metrics-filters";
import { IosLimitedLabel } from "../components/IosLimitedLabel";
import { EmptyState, ErrorState, SkeletonList } from "../components/States";

type GameRow = {
  id: string;
  name: string;
  draft: boolean;
  summary: string;
};

export function GamesPage() {
  const [games, setGames] = useState<GameRow[] | null>(null);
  const [headlines, setHeadlines] = useState<Awaited<
    ReturnType<typeof api.metricsOverview>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = filtersToQuery({ ...defaultMetricsFilters(), gameId: "", platform: "" });
    void Promise.all([api.games(), api.metricsOverview(q)])
      .then(([g, m]) => {
        setGames(g.games);
        setHeadlines(m);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <section className="page">
      <header className="page-header">
        <h1>Games</h1>
        <p>Studio headlines, then open a title for its own dashboard.</p>
      </header>

      {error ? <ErrorState message={error} /> : null}
      {!error && !games ? <SkeletonList rows={3} /> : null}

      {headlines ? (
        <div className="studio-headlines">
          <h2 className="section-title">Studio headlines</h2>
          <p className="metrics-caption">
            Cross-game only — open a game below for levels, coins and ads.{" "}
            <IosLimitedLabel />
          </p>
          {headlines.dau === 0 && headlines.newAccounts === 0 ? (
            <EmptyState title="No traffic yet" body="Headlines appear after players open a game." />
          ) : (
            <dl className="facts wide metrics-kpis" aria-label="Studio headlines">
              <div>
                <dt>New players</dt>
                <dd>{headlines.newAccounts}</dd>
              </div>
              <div>
                <dt>Daily players</dt>
                <dd>{headlines.dau}</dd>
              </div>
              <div>
                <dt>Weekly players</dt>
                <dd>{headlines.wau}</dd>
              </div>
              <div>
                <dt>Day 1 return</dt>
                <dd>{pct(headlines.retention.d1)}</dd>
              </div>
            </dl>
          )}
        </div>
      ) : null}

      {games ? (
        <ul className="game-list">
          {games.map((g) => (
            <li key={g.id}>
              <div className="game-card-head">
                <h2>
                  <Link to={`/games/${g.id}`}>{g.name}</Link>
                </h2>
                <span className={`badge ${g.draft ? "draft" : "live"}`}>
                  {g.draft ? "Draft" : "Live"}
                </span>
              </div>
              <p>{g.summary}</p>
              <p>
                <Link className="text-link" to={`/games/${g.id}`}>
                  Open dashboard
                </Link>
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
