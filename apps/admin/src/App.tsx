import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";

/** Scaffold shell — full routes land in the admin dashboard feature. */
export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
