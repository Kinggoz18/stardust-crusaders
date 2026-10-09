import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [needsBootstrap, setNeedsBootstrap] = useState<boolean | null>(null);

  useEffect(() => {
    void api
      .bootstrapStatus()
      .then((s) => setNeedsBootstrap(s.needsBootstrap))
      .catch(() => setNeedsBootstrap(false));
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      const result = await api.login({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        totpCode: String(form.get("code") ?? ""),
      });
      auth.setRole(result.role);
      navigate("/accounts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login">
      <h1>Stardust Crusaders</h1>
      <p>Sign in to manage your studio.</p>
      {needsBootstrap ? (
        <p className="lede">
          First time here?{" "}
          <Link to="/setup">Set up the master admin</Link>
        </p>
      ) : null}
      <form onSubmit={onSubmit} noValidate>
        <label htmlFor="email">Work email</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
        <label htmlFor="code">Authenticator code</label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          required
        />
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
