import { useAuth } from "../lib/auth";
import { EmptyState } from "../components/States";

export function StaffSettingsPage() {
  const auth = useAuth();

  if (auth.role === "viewer") {
    return (
      <section className="page">
        <header className="page-header">
          <h1>Staff</h1>
        </header>
        <EmptyState
          title="View only"
          body="Ask an owner to change staff access for you."
        />
      </section>
    );
  }

  return (
    <section className="page">
      <header className="page-header">
        <h1>Staff</h1>
        <p>People who can open the studio desk.</p>
      </header>
      <p className="lede">
        Your role: <strong>{auth.role}</strong>. Invite more staff from a later release.
      </p>
    </section>
  );
}
