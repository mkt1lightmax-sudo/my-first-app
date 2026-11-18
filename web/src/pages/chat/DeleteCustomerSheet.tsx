import { useState, type FormEvent } from "react";
import { api, ApiError } from "../../lib/api";
import type { Conversation } from "../../lib/chat";

// ลบข้อมูลลูกค้ารายนี้ทั้งหมด (ตามคำขอลบข้อมูล / PDPA) — เจ้าของเท่านั้น, ต้องพิมพ์ชื่อยืนยัน
export default function DeleteCustomerSheet({
  conversation,
  onDeleted,
  onClose,
}: {
  conversation: Conversation;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const name = conversation.display_name || String(conversation.id);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/chat/conversations/${conversation.id}`, { confirm: typed.trim() });
      onDeleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full max-w-md space-y-4 rounded-t-3xl bg-white px-5 pb-6 pt-4 shadow-2xl">
        <h2 className="text-base font-semibold text-brand-red">ลบข้อมูลลูกค้านี้ทั้งหมด</h2>
        <p className="text-sm text-gray-700">
          จะลบแชท ข้อความ รูป ข้อมูลติดต่อ โน้ต และยอดขายของ <b>{name}</b> ออกจากระบบ <b>ถาวร กู้คืนไม่ได้</b> ใช้เมื่อลูกค้าขอลบข้อมูล
        </p>
        <p className="text-xs text-gray-500">ข้อความที่อยู่ใน LINE / Facebook ของลูกค้าเองไม่ถูกลบ ถ้าลูกค้าทักมาใหม่ จะเกิดแชทใหม่</p>
        <label className="block">
          <span className="mb-1.5 block text-sm text-gray-700">
            พิมพ์ <b>{name}</b> เพื่อยืนยัน
          </span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="w-full rounded-xl bg-gray-100 px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-red/40"
          />
        </label>
        {error && <p className="text-sm text-brand-red">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy || typed.trim() !== name}
            className="flex-1 rounded-xl bg-brand-red py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "กำลังลบ..." : "ลบถาวร"}
          </button>
          <button type="button" onClick={onClose} className="rounded-xl px-4 text-sm text-gray-600 ring-1 ring-gray-200">
            ยกเลิก
          </button>
        </div>
      </form>
    </div>
  );
}
