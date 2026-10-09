import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { EmptyState, ErrorState, SkeletonList } from "../components/States";

type Row = {
  id: string;
  deviceId: string;
  email: string | null;
  platform: string;
  bannedAt: string | null;
  createdAt: string;
};

export function AccountsPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);

  async function load(query: string, pageCursor?: string, append = false) {
    setError(null);
    if (!append) setRows(null);
    try {
      const data = await api.accounts(query, pageCursor);
      setRows((prev) => (append && prev ? [...prev, ...data.accounts] : data.accounts));
      setCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load players.");
    }
  }

  useEffect(() => {
    void load(q);
  }, [q]);

  const shown = [...(rows ?? [])].sort((a, b) => {
    const av = new Date(a.createdAt).getTime();
    const bv = new Date(b.createdAt).getTime();
    return sort === "newest" ? bv - av : av - bv;
  });

  return (
    <section className="page">
      <header className="page-header">
        <h1>Players</h1>
        <p>Find a player by device or email.</p>
      </header>

      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get("q");
          setParams(value ? { q: String(value) } : {});
        }}
      >
        <label htmlFor="q" className="sr-only">
          Search players
        </label>
        <input id="q" name="q" defaultValue={q} placeholder="Search players" />
        <button type="submit">Search</button>
      </form>

      {error ? <ErrorState message={error} onRetry={() => void load(q)} /> : null}
      {!error && rows === null ? <SkeletonList /> : null}
      {!error && rows && rows.length === 0 ? (
        <EmptyState title="No players yet" body="New players appear here after their first launch." />
      ) : null}

      {!error && rows && rows.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <button type="button" className="sort" onClick={() => setSort(sort === "newest" ? "oldest" : "newest")}>
                    Joined {sort === "newest" ? "↓" : "↑"}
                  </button>
                </th>
                <th scope="col">Device</th>
                <th scope="col">Email</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link to={`/accounts/${row.id}`}>
                      {new Date(row.createdAt).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos" })}
                    </Link>
                  </td>
                  <td>{row.deviceId}</td>
                  <td>{row.email ?? "—"}</td>
                  <td>{row.bannedAt ? "Blocked" : "Active"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {cursor ? (
            <button type="button" className="ghost" onClick={() => void load(q, cursor, true)}>
              Load more
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
