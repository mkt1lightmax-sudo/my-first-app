import { useState, type FormEvent } from "react";
import { api, ApiError } from "../../lib/api";
import type { Conversation } from "../../lib/chat";

// การ์ดข้อมูลลูกค้าในหน้าแชท: เบอร์โทร (กดโทรได้), ที่อยู่ (กดเปิดแผนที่ได้), โน้ตของทีม (ลูกค้าไม่เห็น)
export default function CustomerInfoCard({
  conversation,
  canEdit,
  onChange,
}: {
  conversation: Conversation;
  canEdit: boolean;
  onChange: (c: Conversation) => void;
}) {
  const c = conversation;
  const hasInfo = Boolean(c.customer_phone || c.customer_address || c.customer_note);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);

  if (editing) {
    return <EditForm conversation={c} onCancel={() => setEditing(false)} onSaved={(nc) => (onChange(nc), setEditing(false), setOpen(true))} />;
  }

  if (!hasInfo) {
    if (!canEdit) return null;
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex w-full items-center gap-2 border-b border-gray-100 bg-white px-4 py-2.5 text-left text-xs text-brand-navy active:bg-gray-50"
      >
        <span aria-hidden>📇</span> + เพิ่มเบอร์โทร / ที่อยู่ / โน้ตลูกค้า
      </button>
    );
  }

  return (
    <div className="border-b border-gray-100 bg-white px-4 py-2.5">
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span aria-hidden>📇</span>
          <span className="min-w-0 flex-1 truncate text-xs text-gray-700">
            {[c.customer_phone, c.customer_address, c.customer_note && "มีโน้ต"].filter(Boolean).join(" · ")}
          </span>
          <span className="text-xs text-gray-400">{open ? "▲" : "▼"}</span>
        </button>
        {c.customer_phone && (
          <a
            href={`tel:${c.customer_phone.replace(/[^\d+]/g, "")}`}
            className="flex-shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200"
          >
            📞 โทร
          </a>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-2.5 text-sm">
          {c.customer_phone && (
            <InfoRow label="เบอร์โทร">
              <a href={`tel:${c.customer_phone.replace(/[^\d+]/g, "")}`} className="text-brand-navy underline-offset-2 hover:underline">
                {c.customer_phone}
              </a>
            </InfoRow>
          )}
          {c.customer_address && (
            <InfoRow label="ที่อยู่">
              <span className="whitespace-pre-wrap">{c.customer_address}</span>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.customer_address)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-xs text-brand-navy underline-offset-2 hover:underline"
              >
                📍 เปิดใน Google Maps
              </a>
            </InfoRow>
          )}
          {c.customer_note && (
            <InfoRow label="โน้ต">
              <span className="whitespace-pre-wrap">{c.customer_note}</span>
            </InfoRow>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-gray-400">
              {c.customer_info_updated_by_name
                ? `แก้ล่าสุดโดย ${c.customer_info_updated_by_name} · ${new Date(c.customer_info_updated_at!).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}`
                : ""}
            </span>
            {canEdit && (
              <button onClick={() => setEditing(true)} className="text-xs font-medium text-brand-navy">
                แก้ไข
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2">
      <div className="text-[11px] text-gray-400">{label}</div>
      <div className="text-gray-900">{children}</div>
    </div>
  );
}

function EditForm({
  conversation,
  onCancel,
  onSaved,
}: {
  conversation: Conversation;
  onCancel: () => void;
  onSaved: (c: Conversation) => void;
}) {
  const [phone, setPhone] = useState(conversation.customer_phone ?? "");
  const [address, setAddress] = useState(conversation.customer_address ?? "");
  const [note, setNote] = useState(conversation.customer_note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const d = await api.patch<{ ok: true; conversation: Conversation }>(`/chat/conversations/${conversation.id}`, {
        customer_phone: phone,
        customer_address: address,
        customer_note: note,
      });
      onSaved(d.conversation);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  const input =
    "w-full rounded-xl bg-gray-100 px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/30";

  return (
    <form onSubmit={save} className="space-y-2.5 border-b border-gray-100 bg-white px-4 py-3">
      <div className="text-xs font-semibold text-gray-500">ข้อมูลลูกค้า (ทีมเห็นเท่านั้น ลูกค้าไม่เห็น)</div>
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        inputMode="tel"
        maxLength={30}
        placeholder="เบอร์โทร เช่น 081-234-5678"
        className={input}
      />
      <textarea
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="ที่อยู่ / สถานที่ติดตั้ง"
        className={`${input} resize-none`}
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="โน้ต เช่น ค่าไฟ 5,000/เดือน, หลังคาเมทัลชีท, สะดวกให้ติดต่อช่วงเย็น"
        className={`${input} resize-none`}
      />
      {error && <p className="text-xs text-brand-red">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-brand-navy py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl px-4 text-sm text-gray-600 ring-1 ring-gray-200">
          ยกเลิก
        </button>
      </div>
    </form>
  );
}
