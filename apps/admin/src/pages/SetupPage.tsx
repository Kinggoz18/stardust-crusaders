import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../lib/api";

export function SetupPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    void api
      .bootstrapStatus()
      .then((s) => setAllowed(s.needsBootstrap))
      .catch(() => setAllowed(false));
  }, []);

  if (allowed === false) {
    return <Navigate to="/login" replace />;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      const created = await api.bootstrap({
        masterKey: String(form.get("masterKey") ?? ""),
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      setTotpSecret(created.totpSecret);
      setEmail(created.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (totpSecret && email) {
    return (
      <main className="login">
        <h1>Stardust Crusaders</h1>
        <h2>Add your authenticator</h2>
        <p>
          Scan or enter this key in your authenticator app for <strong>{email}</strong>, then sign
          in.
        </p>
        <p className="setup-code" role="status">
          {totpSecret}
        </p>
        <p className="lede">Remove the setup key from the server environment when you can.</p>
        <Link className="button-link" to="/login">
          Continue to sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="login">
      <h1>Stardust Crusaders</h1>
      <h2>Set up the master admin</h2>
      <p>One-time studio setup. You will be the first owner.</p>
      {allowed === null ? <p>Checking…</p> : null}
      {allowed ? (
        <form onSubmit={(e) => void onSubmit(e)} noValidate>
          <label htmlFor="masterKey">Setup key</label>
          <input
            id="masterKey"
            name="masterKey"
            type="password"
            autoComplete="off"
            required
            minLength={32}
          />
          <label htmlFor="email">Your work email</label>
          <input id="email" name="email" type="email" autoComplete="username" required />
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
            {pending ? "Setting up…" : "Create owner"}
          </button>
        </form>
      ) : null}
      <p className="lede">
        <Link to="/login">Back to sign in</Link>
      </p>
    </main>
  );
}
