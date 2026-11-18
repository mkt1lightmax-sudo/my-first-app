import { useEffect, useState, type FormEvent } from "react";
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
  const [passwordFor, setPasswordFor] = useState<StaffMember | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
      {notice && <p className="mb-3 rounded-xl bg-green-50 p-3 text-sm text-green-800">{notice}</p>}

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
            <div className="flex flex-shrink-0 flex-col items-end gap-2">
              {isOwner(currentStaff) && (
                <button onClick={() => setPasswordFor(s)} className="text-sm text-brand-navy hover:underline">
                  เปลี่ยนรหัส
                </button>
              )}
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
          </div>
        ))}
      </div>

      {passwordFor && (
        <ChangePasswordSheet
          staff={passwordFor}
          isSelf={passwordFor.id === currentStaff?.id}
          onDone={(msg) => {
            setPasswordFor(null);
            setNotice(msg);
          }}
          onClose={() => setPasswordFor(null)}
        />
      )}
    </div>
  );
}

// ตั้งรหัสผ่านใหม่ (เจ้าของเท่านั้น)
function ChangePasswordSheet({
  staff,
  isSelf,
  onDone,
  onClose,
}: {
  staff: StaffMember;
  isSelf: boolean;
  onDone: (msg: string) => void;
  onClose: () => void;
}) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) return setError("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");
    if (pw !== pw2) return setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
    setSaving(true);
    try {
      await api.put(`/staff/${staff.id}/password`, { password: pw });
      onDone(
        isSelf
          ? "เปลี่ยนรหัสผ่านของคุณแล้ว — เครื่องอื่นที่ล็อกอินค้างไว้ต้องเข้าสู่ระบบใหม่"
          : `เปลี่ยนรหัสผ่านของ ${staff.name} แล้ว — ส่งรหัสใหม่ให้เจ้าตัว (ทุกเครื่องที่ล็อกอินอยู่จะต้องเข้าสู่ระบบใหม่)`
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "เปลี่ยนรหัสไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-2xl bg-gray-100 px-4 py-3 text-[15px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/30";

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <form onSubmit={save} className="relative w-full max-w-md space-y-4 rounded-t-3xl bg-white px-5 pb-6 pt-3 shadow-2xl">
        <div className="flex items-center justify-between">
          <button type="button" onClick={onClose} className="text-sm text-gray-500">
            ปิด
          </button>
          <div className="flex flex-col items-center">
            <span className="mb-2 h-1 w-10 rounded-full bg-gray-200" />
            <span className="text-base font-semibold text-gray-900">เปลี่ยนรหัสผ่าน</span>
          </div>
          <span className="w-8" />
        </div>
        <p className="text-sm text-gray-600">
          ตั้งรหัสใหม่ให้ <b>{isSelf ? "ตัวคุณเอง" : staff.name}</b> ({staff.email})
        </p>
        <input
          type={show ? "text" : "password"}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)"
          autoComplete="new-password"
          className={inputClass}
        />
        <input
          type={show ? "text" : "password"}
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          placeholder="พิมพ์รหัสใหม่อีกครั้ง"
          autoComplete="new-password"
          className={inputClass}
        />
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          แสดงรหัสผ่าน
        </label>
        <p className="text-xs text-gray-400">
          {isSelf ? "เครื่องนี้ยังอยู่ในระบบต่อ เครื่องอื่นต้องเข้าสู่ระบบใหม่" : "ทุกเครื่องที่คนนี้ล็อกอินอยู่ จะต้องเข้าสู่ระบบใหม่ด้วยรหัสใหม่"}
        </p>
        {error && <p className="text-sm text-brand-red">{error}</p>}
        <button type="submit" disabled={saving} className="w-full rounded-2xl bg-brand-navy py-3.5 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
        </button>
      </form>
    </div>
  );
}
