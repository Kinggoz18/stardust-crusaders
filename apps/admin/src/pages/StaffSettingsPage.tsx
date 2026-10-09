import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { EmptyState, ErrorState, SkeletonList } from "../components/States";

type StaffRow = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  disabledAt: string | null;
};

export function StaffSettingsPage() {
  const auth = useAuth();
  const [people, setPeople] = useState<StaffRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteOk, setInviteOk] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function load() {
    setError(null);
    try {
      const data = await api.staff();
      setPeople(data.staff);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load staff.");
    }
  }

  useEffect(() => {
    if (auth.role === "viewer") return;
    void load();
  }, [auth.role]);

  if (auth.role === "viewer") {
    return (
      <section className="page">
        <header className="page-header">
          <h1>Staff</h1>
        </header>
        <EmptyState title="View only" body="Ask an owner to change staff access for you." />
      </section>
    );
  }

  async function onInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (auth.role !== "owner") return;
    setInviteError(null);
    setInviteOk(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      const created = await api.inviteStaff({
        email: String(form.get("email") ?? ""),
        role: String(form.get("role") ?? "viewer"),
        password: String(form.get("password") ?? ""),
      });
      setInviteOk(
        `Invite ready for ${created.email}. Share the password you chose and this authenticator key: ${created.totpSecret}`,
      );
      e.currentTarget.reset();
      await load();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Invite failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <h1>Staff</h1>
        <p>People who can open the studio desk.</p>
      </header>

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!error && !people ? <SkeletonList rows={3} /> : null}
      {people && people.length === 0 ? (
        <EmptyState title="No staff yet" body="Invite the first teammate below." />
      ) : null}

      {people && people.length > 0 ? (
        <ul className="staff-list">
          {people.map((p) => (
            <li key={p.id} className="staff-item">
              <p className="staff-email">{p.email}</p>
              <p className="staff-meta">
                {roleLabel(p.role)}
                {p.disabledAt ? " · Disabled" : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {auth.role === "owner" ? (
        <form className="invite-form" onSubmit={(e) => void onInvite(e)}>
          <h2>Invite staff</h2>
          <label htmlFor="email">Work email</label>
          <input id="email" name="email" type="email" required autoComplete="off" />
          <label htmlFor="role">Role</label>
          <select id="role" name="role" defaultValue="viewer">
            <option value="viewer">Viewer</option>
            <option value="support">Support</option>
            <option value="owner">Owner</option>
          </select>
          <label htmlFor="password">Temporary password</label>
          <input id="password" name="password" type="text" minLength={10} required autoComplete="off" />
          {inviteError ? (
            <p className="form-error" role="alert">
              {inviteError}
            </p>
          ) : null}
          {inviteOk ? (
            <p className="form-success" role="status">
              {inviteOk}
            </p>
          ) : null}
          <button type="submit" disabled={pending}>
            {pending ? "Inviting…" : "Send invite"}
          </button>
        </form>
      ) : (
        <p className="lede">Only an owner can invite new staff.</p>
      )}
    </section>
  );
}

function roleLabel(role: string): string {
  if (role === "owner") return "Owner";
  if (role === "support") return "Support";
  return "Viewer";
}
