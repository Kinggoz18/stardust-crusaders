import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { Shell } from "./components/Shell";
import { LoginPage } from "./pages/LoginPage";
import { AccountsPage } from "./pages/AccountsPage";
import { AccountDetailPage } from "./pages/AccountDetailPage";
import { AccountGamePage } from "./pages/AccountGamePage";
import { GamesPage } from "./pages/GamesPage";
import { MetricsPage } from "./pages/MetricsPage";
import { AuditPage } from "./pages/AuditPage";
import { StaffSettingsPage } from "./pages/StaffSettingsPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (!auth.ready) return null;
  if (!auth.role) return <Navigate to="/login" replace />;
  return children;
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <Shell />
            </RequireAuth>
          }
        >
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/accounts/:id" element={<AccountDetailPage />} />
          <Route path="/accounts/:id/games/:game" element={<AccountGamePage />} />
          <Route path="/games" element={<GamesPage />} />
          <Route path="/metrics" element={<MetricsPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/settings/staff" element={<StaffSettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/accounts" replace />} />
      </Routes>
    </AuthProvider>
  );
}
