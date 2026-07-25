import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { STAFF_ROLES, STAFF_ROLE_LABELS, type StaffRole } from "../../lib/staff";

export default function StaffFormPage() {
  const { staff: currentStaff } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("sales");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (currentStaff && currentStaff.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/staff", { name, email, password, role });
      navigate("/staff");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "สร้างบัญชีไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm";
  const labelClass = "mb-1 block text-sm text-gray-700";

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900">เพิ่มพนักงาน</h1>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border bg-white p-4">
        <div>
          <label className={labelClass}>ชื่อ *</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>อีเมล *</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>รหัสผ่าน *</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-gray-400">อย่างน้อย 8 ตัวอักษร</p>
        </div>

        <div>
          <label className={labelClass}>ตำแหน่ง *</label>
          <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)} className={inputClass}>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {STAFF_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-brand-red">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-navy py-3 text-sm font-semibold text-white hover:bg-brand-navy-light disabled:opacity-50"
        >
          {submitting ? "กำลังสร้าง..." : "สร้างบัญชี"}
        </button>
      </form>
    </div>
  );
}
