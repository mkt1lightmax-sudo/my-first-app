import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { staff, loading } = useAuth();

  if (loading) {
    return <div className="p-6 text-gray-500">กำลังโหลด...</div>;
  }

  if (!staff) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
