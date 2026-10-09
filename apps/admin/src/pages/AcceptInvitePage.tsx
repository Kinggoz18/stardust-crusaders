import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<{ email: string; totpSecret: string } | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      const created = await api.acceptInvite({
        token: String(form.get("token") ?? token),
        password: String(form.get("password") ?? ""),
      });
      setDone({ email: created.email, totpSecret: created.totpSecret });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <main className="login">
        <h1>Stardust Crusaders</h1>
        <h2>Add your authenticator</h2>
        <p>
          Enter this key for <strong>{done.email}</strong>, then sign in.
        </p>
        <p className="setup-code" role="status">
          {done.totpSecret}
        </p>
        <Link className="button-link" to="/login">
          Continue to sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="login">
      <h1>Stardust Crusaders</h1>
      <h2>Join the studio</h2>
      <p>Choose a password, then add an authenticator app.</p>
      <form onSubmit={(e) => void onSubmit(e)} noValidate>
        <label htmlFor="token">Invite code</label>
        <input id="token" name="token" defaultValue={token} required autoComplete="off" />
        <label htmlFor="password">Choose a password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
        />
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={pending}>
          {pending ? "Joining…" : "Accept invite"}
        </button>
      </form>
      <p className="lede">
        <Link to="/login">Back to sign in</Link>
      </p>
    </main>
  );
}
