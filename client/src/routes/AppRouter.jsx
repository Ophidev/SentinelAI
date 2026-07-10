import { Routes, Route } from "react-router-dom";
import Login from "../pages/Login/Login";
import Register from "../pages/Register/Register";
import Dashboard from "../pages/Dashboard/Dashboard";
import Scan from "../pages/Scan/Scan";
import History from "../pages/History/History";
import ProtectedRoute from "./ProtectedRoute";

// Central place listing every page and which URL renders it.
// Pages not wired up yet today (Report, Profile, Settings) are intentionally
// left out — see docs/HLD.md for the full planned scope.
export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/projects/:projectId/scan"
        element={
          <ProtectedRoute>
            <Scan />
          </ProtectedRoute>
        }
      />

      <Route
        path="/projects/:projectId/history"
        element={
          <ProtectedRoute>
            <History />
          </ProtectedRoute>
        }
      />

      {/* Anything else (including "/") just goes to the dashboard/login flow */}
      <Route path="*" element={<Login />} />
    </Routes>
  );
}
