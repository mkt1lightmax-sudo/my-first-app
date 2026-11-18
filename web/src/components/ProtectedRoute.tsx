import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { can, type Permission } from "../lib/permissions";

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

// หน้าที่ต้องมีสิทธิ์เฉพาะ — ไม่มีสิทธิ์จะถูกพากลับหน้าหลัก
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { staff } = useAuth();
  if (!can(staff, permission)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
