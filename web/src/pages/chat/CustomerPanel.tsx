import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import type { Conversation } from "../../lib/chat";

type StaffOption = { id: number; name: string };

// แผงด้านบนของหน้าแชท: เลือกผู้ดูแลลูกค้า + ติดป้ายกลุ่ม
export default function CustomerPanel({
  conversation,
  onChange,
}: {
  conversation: Conversation;
  onChange: (c: Conversation) => void;
}) {
  const { staff: me } = useAuth();
  const [open, setOpen] = useState(false);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ ok: true; staff: StaffOption[] }>("/staff").then((d) => setStaffList(d.staff)).catch(() => {});
    api.get<{ ok: true; tags: string[] }>("/chat/tags").then((d) => setAllTags(d.tags)).catch(() => {});
  }, []);

  async function save(body: { assigned_staff_id?: number | null; tags?: string[] }) {
    setSaving(true);
    setError(null);
    try {
      const d = await api.patch<{ ok: true; conversation: Conversation }>(`/chat/conversations/${conversation.id}`, body);
      onChange(d.conversation);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  function toggleTag(t: string) {
    const has = conversation.tags.includes(t);
    save({ tags: has ? conversation.tags.filter((x) => x !== t) : [...conversation.tags, t] });
  }

  function handleAddTag(e: FormEvent) {
    e.preventDefault();
    const t = newTag.trim();
    if (!t) return;
    if (!allTags.includes(t)) setAllTags((prev) => [...prev, t]);
    if (!conversation.tags.includes(t)) save({ tags: [...conversation.tags, t] });
    setNewTag("");
  }

  const isMine = me && conversation.assigned_staff_id === me.id;

  return (
    <div className="border-b bg-white px-4 py-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 text-xs">
          <span className="text-gray-500">ผู้ดูแล: </span>
          <span className={conversation.assigned_staff_name ? "font-medium text-brand-navy" : "text-gray-400"}>
            {conversation.assigned_staff_name ?? "ยังไม่มี"}
          </span>
          {conversation.tags.length > 0 && <span className="text-gray-400"> · {conversation.tags.join(", ")}</span>}
        </div>
        {me && !isMine && (
          <button
            onClick={() => save({ assigned_staff_id: me.id })}
            disabled={saving}
            className="flex-shrink-0 rounded-md bg-brand-red px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            รับเรื่อง
          </button>
        )}
        <button onClick={() => setOpen((v) => !v)} className="flex-shrink-0 rounded-md border px-2.5 py-1 text-xs text-brand-navy">
          {open ? "ปิด" : "จัดการ"}
        </button>
      </div>

      {open && (
        <div className="mt-2 space-y-3 pb-1">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-700">ลูกค้าของ / มอบหมายให้ตอบ</span>
            <select
              value={conversation.assigned_staff_id ?? ""}
              disabled={saving}
              onChange={(e) => save({ assigned_staff_id: e.target.value ? Number(e.target.value) : null })}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">— ยังไม่มีคนดูแล —</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {me && s.id === me.id ? " (ฉัน)" : ""}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="mb-1 block text-xs font-medium text-gray-700">กลุ่มลูกค้า (เลือกได้หลายอัน)</span>
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((t) => {
                const active = conversation.tags.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleTag(t)}
                    disabled={saving}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      active ? "border-brand-navy bg-brand-navy text-white" : "border-gray-300 text-gray-600"
                    }`}
                  >
                    {active ? "✓ " : ""}
                    {t}
                  </button>
                );
              })}
            </div>
            <form onSubmit={handleAddTag} className="mt-2 flex gap-2">
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                maxLength={30}
                placeholder="สร้างกลุ่มใหม่ เช่น ลูกค้าโรงงาน"
                className="min-w-0 flex-1 rounded-lg border px-3 py-1.5 text-sm"
              />
              <button type="submit" disabled={!newTag.trim()} className="rounded-lg bg-brand-navy px-3 text-xs text-white disabled:opacity-40">
                เพิ่ม
              </button>
            </form>
          </div>
          {error && <p className="text-xs text-brand-red">{error}</p>}
        </div>
      )}
    </div>
  );
}
