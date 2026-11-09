import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="text-slate-400">Loading...</p>;

  // After login, user comes back to this same page
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;

  return children;
}