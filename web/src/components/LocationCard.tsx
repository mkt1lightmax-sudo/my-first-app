import { useState } from "react";
import MapPinPicker from "./MapPinPicker";

// ตำแหน่งหน้างานแบบล็อก: ปกติดูได้อย่างเดียว (ซูมได้ ลากหมุดไม่ได้) + ปุ่มนำทาง
// คนที่มีสิทธิ์กด "อัปเดตตำแหน่งหน้างาน" → จับ GPS → ปรับหมุดได้ → บันทึก / ยกเลิก แล้วล็อกกลับ
type Props = {
  lat: number | null;
  lng: number | null;
  mapUrl?: string | null; // ลิงก์ที่กรอกไว้ (ใช้นำทางถ้ายังไม่ได้ปักหมุด)
  canUpdate: boolean;
  onSave: (lat: number, lng: number) => Promise<void>;
};

const navUrl = (lat: number | null, lng: number | null, mapUrl?: string | null) =>
  lat != null && lng != null ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : mapUrl || null;

export default function LocationCard({ lat, lng, mapUrl, canUpdate, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nav = navUrl(lat, lng, mapUrl);

  function startUpdate() {
    setError(null);
    setDraft(lat != null && lng != null ? { lat, lng } : null);
    setEditing(true);
  }

  async function save() {
    if (!draft) {
      setError("ยังไม่ได้ปักหมุด — กดใช้ตำแหน่งปัจจุบัน หรือแตะบนแผนที่");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(draft.lat, draft.lng);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกตำแหน่งไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      {editing ? (
        <>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">กำลังอัปเดตตำแหน่ง — กดใช้ตำแหน่งปัจจุบัน หรือลากหมุดให้ตรงหน้างาน แล้วกดบันทึก</p>
          <MapPinPicker key="edit" lat={draft?.lat ?? null} lng={draft?.lng ?? null} onChange={(a, b) => setDraft({ lat: a, lng: b })} autoLocate />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(false)} disabled={saving} className="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm text-gray-700">
              ยกเลิก
            </button>
            <button type="button" onClick={save} disabled={saving} className="flex-1 rounded-lg bg-brand-navy py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "บันทึกตำแหน่งนี้"}
            </button>
          </div>
        </>
      ) : (
        <>
          {lat != null && lng != null ? (
            <MapPinPicker key="view" lat={lat} lng={lng} onChange={() => {}} disabled />
          ) : (
            <p className="rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-500">ยังไม่ได้ปักหมุดตำแหน่ง</p>
          )}
          <div className="flex flex-wrap gap-2">
            {nav && (
              <a
                href={nav}
                target="_blank"
                rel="noreferrer"
                className="flex-1 rounded-lg bg-[#EDF4EF] px-4 py-2.5 text-center text-sm font-medium text-[#4C6B57] hover:bg-[#E1EDE5]"
              >
                📍 นำทาง (Google Maps)
              </a>
            )}
            {canUpdate && (
              <button type="button" onClick={startUpdate} className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                ✏️ อัปเดตตำแหน่งหน้างาน
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
