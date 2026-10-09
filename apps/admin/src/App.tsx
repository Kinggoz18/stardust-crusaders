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
import { GameShell } from "./components/game/GameShell";
import { GameOverviewPage } from "./pages/game/GameOverviewPage";
import { GamePlayersPage } from "./pages/game/GamePlayersPage";
import { GameLevelsPage } from "./pages/game/GameLevelsPage";
import { GameEconomyPage } from "./pages/game/GameEconomyPage";
import { GameAdsPage } from "./pages/game/GameAdsPage";
import { GameEventsPage } from "./pages/game/GameEventsPage";
import { GameCurvePage } from "./pages/game/GameCurvePage";
import { GameHintsPage } from "./pages/game/GameHintsPage";
import { GameIslandPage } from "./pages/game/GameIslandPage";
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
          <Route path="/games/:game" element={<GameShell />}>
            <Route index element={<GameOverviewPage />} />
            <Route path="players" element={<GamePlayersPage />} />
            <Route path="levels" element={<GameLevelsPage />} />
            <Route path="economy" element={<GameEconomyPage />} />
            <Route path="ads" element={<GameAdsPage />} />
            <Route path="events" element={<GameEventsPage />} />
            <Route path="curve" element={<GameCurvePage />} />
            <Route path="hints" element={<GameHintsPage />} />
            <Route path="island" element={<GameIslandPage />} />
          </Route>
          <Route path="/metrics" element={<MetricsPage />} />
          {/* Old shared metrics routes → game dashboards */}
          <Route path="/metrics/retention" element={<Navigate to="/metrics" replace />} />
          <Route path="/metrics/funnel" element={<Navigate to="/games/one-spark/levels" replace />} />
          <Route
            path="/metrics/difficulty"
            element={<Navigate to="/games/one-spark/curve" replace />}
          />
          <Route
            path="/metrics/economy"
            element={<Navigate to="/games/one-spark/economy" replace />}
          />
          <Route path="/metrics/ads" element={<Navigate to="/games/one-spark/ads" replace />} />
          <Route path="/metrics/quality" element={<Navigate to="/metrics" replace />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/settings/staff" element={<StaffSettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/accounts" replace />} />
      </Routes>
    </AuthProvider>
  );
}
