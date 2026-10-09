import { NavLink, Navigate, Outlet, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import {
  GAME_IDS,
  GAME_LABELS,
  gamePath,
  parseGameId,
  sectionsForGame,
  type AdminGameId,
} from "../../lib/games";

export function GameShell() {
  const { game } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const gameId = parseGameId(game);
  if (!gameId) return <Navigate to="/games" replace />;

  const sections = sectionsForGame(gameId, auth.role);

  return (
    <section className="page game-dash">
      <header className="page-header game-dash-header">
        <div>
          <p className="eyebrow">Game dashboard</p>
          <h1>{GAME_LABELS[gameId]}</h1>
          <p>Numbers and tools for this title only.</p>
        </div>
        <label className="game-switcher">
          Switch game
          <select
            value={gameId}
            onChange={(e) => {
              const next = e.target.value as AdminGameId;
              void navigate(gamePath(next));
            }}
            aria-label="Switch game"
          >
            {GAME_IDS.map((id) => (
              <option key={id} value={id}>
                {GAME_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
      </header>

      <nav className="metrics-tabs game-tabs" aria-label={`${GAME_LABELS[gameId]} sections`}>
        {sections.map((s) => (
          <NavLink
            key={s.slug || "overview"}
            to={gamePath(gameId, s.slug)}
            end={s.slug === ""}
            className={({ isActive }) => (isActive ? "active" : undefined)}
          >
            {s.label}
          </NavLink>
        ))}
      </nav>

      <Outlet context={{ gameId } satisfies { gameId: AdminGameId }} />
    </section>
  );
}
