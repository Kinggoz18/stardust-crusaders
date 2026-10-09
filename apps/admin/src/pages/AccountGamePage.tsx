import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { EmptyState, ErrorState, SkeletonList } from "../components/States";

export function AccountGamePage() {
  const { id = "", game = "" } = useParams();
  const [state, setState] = useState<"loading" | "empty" | "ready" | "error">("loading");
  const [doc, setDoc] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setState("loading");
      try {
        const data = await api.account(id);
        const row = data.progress.find((p) => p.gameId === game);
        if (!row) {
          setState("empty");
          return;
        }
        setDoc(row.document);
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
        <h1>{game.replace("-", " ")}</h1>
        <p>Saved progress for this game.</p>
      </header>
      {state === "loading" ? <SkeletonList rows={3} /> : null}
      {state === "error" ? <ErrorState message={error ?? "Could not load progress."} /> : null}
      {state === "empty" ? (
        <EmptyState title="No progress" body="This player has not saved this game yet." />
      ) : null}
      {state === "ready" ? (
        <pre className="doc-view" tabIndex={0}>
          {JSON.stringify(doc, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}
