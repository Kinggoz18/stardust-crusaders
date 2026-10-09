import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  gameAdminMeta,
  gameDisplayName,
  gameIdSchema,
  summarizeProgress,
  type ProgressAdminSummary,
} from "@stardust/schema";
import { api } from "../lib/api";
import { EmptyState, ErrorState, SkeletonList } from "../components/States";
import { ProgressSummary } from "../components/ProgressSummary";

export function AccountGamePage() {
  const { id = "", game = "" } = useParams();
  const [state, setState] = useState<"loading" | "empty" | "ready" | "error">("loading");
  const [summary, setSummary] = useState<ProgressAdminSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const parsedGame = gameIdSchema.safeParse(game);
  const title = parsedGame.success ? gameDisplayName(parsedGame.data) : game;

  useEffect(() => {
    void (async () => {
      setState("loading");
      setSummary(null);
      try {
        if (!parsedGame.success) {
          setError("Unknown game.");
          setState("error");
          return;
        }
        const data = await api.account(id);
        const row = data.progress.find((p) => p.gameId === game);
        if (!row) {
          setState("empty");
          return;
        }
        setSummary(summarizeProgress(parsedGame.data, row.document, row.revision));
        setState("ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load progress.");
        setState("error");
      }
    })();
  }, [id, game]);

  return (
    <section className="page">
      <header className="page-header">
        <p className="crumb">
          <Link to={`/accounts/${id}`}>Player</Link>
        </p>
        <h1>{title}</h1>
        <p>
          {parsedGame.success && gameAdminMeta(parsedGame.data).draft
            ? "Draft progress shape — expect changes before launch."
            : "Saved progress for this game."}
        </p>
      </header>
      {state === "loading" ? <SkeletonList rows={3} /> : null}
      {state === "error" ? <ErrorState message={error ?? "Could not load progress."} /> : null}
      {state === "empty" ? (
        <EmptyState title="No progress" body="This player has not saved this game yet." />
      ) : null}
      {state === "ready" && summary ? <ProgressSummary summary={summary} /> : null}
    </section>
  );
}
