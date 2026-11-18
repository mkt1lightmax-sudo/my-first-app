import { useState } from "react";
import { api, ApiError } from "../../lib/api";
import { formatBaht, ticketNumber, type Conversation } from "../../lib/chat";

type Outcome = "won" | "lost" | null;

// รายละเอียดทิกเก็ต: ยอดขาย + ปิดการขายได้หรือไม่
export default function TicketDetailsSheet({
  conversation,
  canEdit,
  onSaved,
  onClose,
}: {
  conversation: Conversation;
  canEdit: boolean;
  onSaved: (c: Conversation) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(conversation.deal_amount !== null ? String(conversation.deal_amount) : "");
  const [outcome, setOutcome] = useState<Outcome>(conversation.deal_outcome);
  const [note, setNote] = useState(conversation.deal_note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const clean = amount.replace(/[,\s฿]/g, "");
      const d = await api.put<{ ok: true; conversation: Conversation }>(`/chat/conversations/${conversation.id}/deal`, {
        amount: clean === "" ? null : Number(clean),
        outcome,
        note,
      });
      onSaved(d.conversation);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-3xl bg-white px-5 pb-6 pt-3 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={onClose} className="text-sm text-gray-500">
            ปิด
          </button>
          <div className="flex flex-col items-center">
            <span className="mb-2 h-1 w-10 rounded-full bg-gray-200" />
            <span className="text-base font-semibold text-gray-900">รายละเอียดทิกเก็ต</span>
          </div>
          <span className="w-8" />
        </div>

        <div className="mb-5 flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
          <span className="font-mono text-sm text-gray-600">{ticketNumber(conversation)}</span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              conversation.status === "closed" ? "bg-gray-200 text-gray-600" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
            }`}
          >
            {conversation.status === "closed" ? "ปิดแล้ว" : "เปิดอยู่"}
          </span>
        </div>

        {canEdit ? (
          <div className="space-y-5">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">ยอดขาย (บาท)</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">฿</span>
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-2xl bg-gray-100 py-3 pl-9 pr-4 text-lg font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
                />
              </div>
            </label>

            <div>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">ปิดการขายได้ไหม</span>
              <div className="grid grid-cols-3 gap-2">
                <OutcomeButton active={outcome === "won"} tone="won" onClick={() => setOutcome("won")}>
                  ✓ ได้
                </OutcomeButton>
                <OutcomeButton active={outcome === "lost"} tone="lost" onClick={() => setOutcome("lost")}>
                  ✕ ไม่ได้
                </OutcomeButton>
                <OutcomeButton active={outcome === null} tone="none" onClick={() => setOutcome(null)}>
                  ยังไม่สรุป
                </OutcomeButton>
              </div>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">หมายเหตุ (ถ้ามี)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="เช่น ระบบ 5kW Hybrid, รอโอนมัดจำ"
                className="w-full resize-none rounded-2xl bg-gray-100 px-4 py-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
              />
            </label>

            <p className="text-xs text-gray-400">ยอดนี้จะนับให้ผู้ดูแลแชท (ถ้ายังไม่มีผู้ดูแล จะนับให้คุณ)</p>
            {error && <p className="text-sm text-brand-red">{error}</p>}

            <button
              onClick={save}
              disabled={saving}
              className="w-full rounded-2xl bg-brand-navy py-3.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        ) : (
          <dl className="space-y-3 text-sm">
            <Row label="ยอดขาย" value={formatBaht(conversation.deal_amount)} />
            <Row
              label="ปิดการขาย"
              value={conversation.deal_outcome === "won" ? "ได้" : conversation.deal_outcome === "lost" ? "ไม่ได้" : "ยังไม่สรุป"}
            />
            {conversation.deal_note && <Row label="หมายเหตุ" value={conversation.deal_note} />}
          </dl>
        )}
      </div>
    </div>
  );
}

function OutcomeButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: "won" | "lost" | "none";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeTone = {
    won: "bg-emerald-600 text-white",
    lost: "bg-brand-red text-white",
    none: "bg-gray-700 text-white",
  }[tone];
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl py-3 text-sm font-semibold transition ${active ? activeTone : "bg-gray-100 text-gray-600"}`}
    >
      {children}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 rounded-2xl bg-gray-50 px-4 py-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-900">{value}</dd>
    </div>
  );
}
