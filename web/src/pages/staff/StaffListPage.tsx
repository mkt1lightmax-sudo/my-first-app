import { useEffect, useState, type FormEvent, type ReactNode } from "react";
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
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<StaffRole | "">("");
  const [menuFor, setMenuFor] = useState<StaffMember | null>(null);

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

  // แก้ชื่อ (เฉพาะเจ้าของ)
  async function handleRename(s: StaffMember) {
    const name = window.prompt(`ชื่อใหม่ของ ${s.name}`, s.name)?.trim();
    if (!name || name === s.name) return;
    setError(null);
    try {
      const d = await api.put<{ ok: true; staff: StaffMember }>(`/staff/${s.id}/name`, { name });
      setStaffList((list) => list?.map((x) => (x.id === s.id ? { ...x, name: d.staff.name } : x)) ?? null);
      setNotice(`เปลี่ยนชื่อเป็น "${d.staff.name}" แล้ว — แสดงทุกหน้าทันที${s.id === currentStaff?.id ? " (รีเฟรชเพื่อเห็นชื่อใหม่ที่หัวแอป)" : ""}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "แก้ชื่อไม่สำเร็จ");
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
  const hasActions = (m: StaffMember) => canManage(m) || isOwner(currentStaff);

  // กรอง + จัดกลุ่มตามตำแหน่ง (เรียงตามลำดับตำแหน่ง แล้วตามชื่อ)
  const q = search.trim().toLowerCase();
  const visible = (staffList ?? []).filter(
    (m) => (!roleFilter || m.role === roleFilter) && (!q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
  );
  const groups = STAFF_ROLES.map((role) => ({
    role,
    members: visible.filter((m) => m.role === role).sort((a, b) => Number(b.is_owner) - Number(a.is_owner) || a.name.localeCompare(b.name, "th")),
  })).filter((g) => g.members.length > 0);

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

      {/* ค้นหา + กรองตำแหน่ง */}
      <div className="mb-3 flex gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อ / อีเมล"
          className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-sm"
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as StaffRole | "")} className="rounded-lg border bg-white px-2 py-2 text-sm">
          <option value="">ทุกตำแหน่ง</option>
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {STAFF_ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      {/* รายชื่อแบบกะทัดรัด จัดกลุ่มตามตำแหน่ง */}
      <div className="space-y-4">
        {groups.map(({ role, members }) => (
          <div key={role}>
            <div className="mb-1 px-1 text-xs font-medium text-gray-500">
              {STAFF_ROLE_LABELS[role]} ({members.length})
            </div>
            <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border bg-white">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1 md:flex md:items-center md:gap-4">
                    <div className="flex min-w-0 items-center gap-1.5 md:w-56">
                      <span className="truncate font-medium text-gray-900">{m.name}</span>
                      {m.is_owner && <span className="flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">เจ้าของ</span>}
                      {m.id === currentStaff?.id && <span className="flex-shrink-0 text-[11px] text-gray-400">(คุณ)</span>}
                    </div>
                    <div className="truncate text-xs text-gray-500 md:flex-1 md:text-sm">{m.email}</div>
                  </div>
                  <span className="hidden flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 sm:inline">
                    {m.is_owner ? "เจ้าของ" : roleLabel(m.role)}
                  </span>
                  {hasActions(m) ? (
                    <button
                      onClick={() => setMenuFor(m)}
                      aria-label={`จัดการ ${m.name}`}
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-lg leading-none text-gray-500 hover:bg-gray-100"
                    >
                      ⋮
                    </button>
                  ) : (
                    <span className="w-8 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {staffList && groups.length === 0 && <p className="text-sm text-gray-400">ไม่พบพนักงาน</p>}
      </div>

      {/* เมนูจัดการของพนักงานแต่ละคน */}
      {menuFor && (
        <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMenuFor(null)} />
          <div className="relative w-full max-w-sm rounded-t-3xl bg-white p-5 pb-7 shadow-2xl sm:rounded-3xl">
            <div className="mb-1 font-semibold text-gray-900">{menuFor.name}</div>
            <div className="mb-4 truncate text-xs text-gray-500">{menuFor.email}</div>

            {canManage(menuFor) && (
              <label className="mb-3 block">
                <span className="mb-1 block text-xs text-gray-500">ตำแหน่ง</span>
                <select
                  value={menuFor.role}
                  disabled={changingId === menuFor.id}
                  onChange={async (e) => {
                    await handleRoleChange(menuFor, e.target.value as StaffRole);
                    setMenuFor(null);
                  }}
                  className="w-full rounded-lg border px-3 py-2 text-sm text-brand-navy disabled:opacity-50"
                >
                  {roleChoices.map((r) => (
                    <option key={r} value={r}>
                      {STAFF_ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="divide-y divide-gray-100 rounded-xl ring-1 ring-gray-100">
              {isOwner(currentStaff) && (
                <MenuButton
                  onClick={() => {
                    const m = menuFor;
                    setMenuFor(null);
                    handleRename(m);
                  }}
                >
                  แก้ชื่อ
                </MenuButton>
              )}
              {isOwner(currentStaff) && (
                <MenuButton
                  onClick={() => {
                    setPasswordFor(menuFor);
                    setMenuFor(null);
                  }}
                >
                  เปลี่ยนรหัสผ่าน
                </MenuButton>
              )}
              {canManage(menuFor) && (
                <MenuButton
                  danger
                  disabled={deletingId === menuFor.id}
                  onClick={async () => {
                    const id = menuFor.id;
                    setMenuFor(null);
                    await handleDelete(id);
                  }}
                >
                  ลบพนักงาน
                </MenuButton>
              )}
            </div>
            <button onClick={() => setMenuFor(null)} className="mt-3 w-full rounded-xl py-2.5 text-sm text-gray-500">
              ปิด
            </button>
          </div>
        </div>
      )}

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

function MenuButton({ children, onClick, danger, disabled }: { children: ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`block w-full px-4 py-3 text-left text-sm disabled:opacity-50 ${danger ? "text-brand-red" : "text-gray-800"} active:bg-gray-50`}
    >
      {children}
    </button>
  );
}
