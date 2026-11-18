import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { roleLabel, STAFF_ROLES, STAFF_ROLE_LABELS, type StaffMember, type StaffRole } from "../../lib/staff";
import { can, isOwner } from "../../lib/permissions";

export default function StaffListPage() {
  const { staff: currentStaff } = useAuth();
  const [staffList, setStaffList] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [changingId, setChangingId] = useState<number | null>(null);

  useEffect(() => {
    load();
  }, []);

  function load() {
    api
      .get<{ ok: true; staff: StaffMember[] }>("/staff")
      .then((data) => setStaffList(data.staff))
      .catch(() => setError("โหลดรายชื่อพนักงานไม่สำเร็จ"));
  }

  async function handleDelete(id: number) {
    if (!confirm("ลบบัญชีพนักงานคนนี้?")) return;
    setDeletingId(id);
    try {
      await api.delete(`/staff/${id}`);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRoleChange(s: StaffMember, role: StaffRole) {
    if (role === s.role) return;
    if (!confirm(`เปลี่ยนตำแหน่งของ ${s.name} เป็น "${STAFF_ROLE_LABELS[role]}"?\nมีผลทันทีทุกเครื่องที่ล็อกอินอยู่`)) return;
    setChangingId(s.id);
    try {
      await api.patch(`/staff/${s.id}`, { role });
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "เปลี่ยนตำแหน่งไม่สำเร็จ");
    } finally {
      setChangingId(null);
    }
  }

  // ใครแก้ใครได้: ไม่ใช่ตัวเอง, ไม่ใช่เจ้าของ, ถ้าเป็นแอดมินต้องให้เจ้าของจัดการ
  const canManage = (s: StaffMember) =>
    currentStaff?.id !== s.id && !s.is_owner && (s.role !== "admin" || isOwner(currentStaff));
  const roleChoices = STAFF_ROLES.filter((r) => r !== "admin" || isOwner(currentStaff));

  if (currentStaff && !can(currentStaff, "staff.manage")) {
    return <Navigate to="/" replace />;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">จัดการพนักงาน</h1>
        <Link to="/staff/new" className="rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium text-white hover:bg-brand-navy-light">
          + เพิ่มพนักงาน
        </Link>
      </div>

      {error && <p className="text-sm text-brand-red">{error}</p>}

      <div className="space-y-2">
        {staffList?.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-xl border bg-white p-4">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-gray-900">{s.name}</span>
                {s.is_owner && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">เจ้าของระบบ</span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-gray-500">
                {s.email}
                {!canManage(s) && <> · {s.is_owner ? "เจ้าของ" : roleLabel(s.role)}</>}
              </div>
              {canManage(s) && (
                <select
                  value={s.role}
                  disabled={changingId === s.id}
                  onChange={(e) => handleRoleChange(s, e.target.value as StaffRole)}
                  className="mt-1.5 rounded-lg border px-2 py-1 text-xs text-brand-navy disabled:opacity-50"
                  aria-label={`ตำแหน่งของ ${s.name}`}
                >
                  {roleChoices.map((r) => (
                    <option key={r} value={r}>
                      {STAFF_ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {canManage(s) && (
              <button
                onClick={() => handleDelete(s.id)}
                disabled={deletingId === s.id}
                className="text-sm text-brand-red hover:underline disabled:opacity-50"
              >
                {deletingId === s.id ? "กำลังลบ..." : "ลบ"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
