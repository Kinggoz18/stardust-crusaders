export function LoginPage() {
  return (
    <main className="login">
      <h1>Stardust Crusaders</h1>
      <p>Sign in to manage your studio.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <label htmlFor="email">Work email</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
        <button type="submit">Sign in</button>
      </form>
    </main>
  );
}
