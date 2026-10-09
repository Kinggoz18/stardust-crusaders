import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { Shell } from "./components/Shell";
import { LoginPage } from "./pages/LoginPage";
import { SetupPage } from "./pages/SetupPage";
import { AcceptInvitePage } from "./pages/AcceptInvitePage";
import { AccountsPage } from "./pages/AccountsPage";
import { AccountDetailPage } from "./pages/AccountDetailPage";
import { AccountGamePage } from "./pages/AccountGamePage";
import { GamesPage } from "./pages/GamesPage";
import { MetricsPage } from "./pages/MetricsPage";
import { MetricsRetentionPage } from "./pages/metrics/RetentionPage";
import { MetricsFunnelPage } from "./pages/metrics/FunnelPage";
import { MetricsDifficultyPage } from "./pages/metrics/DifficultyPage";
import { MetricsEconomyPage } from "./pages/metrics/EconomyPage";
import { MetricsAdsPage } from "./pages/metrics/AdsPage";
import { MetricsQualityPage } from "./pages/metrics/QualityPage";
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
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/invite" element={<AcceptInvitePage />} />
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
          <Route path="/metrics/retention" element={<MetricsRetentionPage />} />
          <Route path="/metrics/funnel" element={<MetricsFunnelPage />} />
          <Route path="/metrics/difficulty" element={<MetricsDifficultyPage />} />
          <Route path="/metrics/economy" element={<MetricsEconomyPage />} />
          <Route path="/metrics/ads" element={<MetricsAdsPage />} />
          <Route path="/metrics/quality" element={<MetricsQualityPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/settings/staff" element={<StaffSettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/accounts" replace />} />
      </Routes>
    </AuthProvider>
  );
}
