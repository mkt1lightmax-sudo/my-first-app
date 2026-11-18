import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { isOwner } from "../../lib/permissions";
import { CHANNEL_COLORS, CHANNEL_LABELS, type ChatAccount } from "../../lib/chat";
import FacebookConnectCard from "./FacebookConnectCard";

type NewChannel = "line" | "messenger" | "instagram";

// หน้าแอดมิน: เพิ่ม/ลบบัญชี LINE OA, เพจ Facebook, Instagram (ไม่จำกัดจำนวน)
export default function ChatAccountsPage() {
  const { staff } = useAuth();
  const [accounts, setAccounts] = useState<ChatAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [channel, setChannel] = useState<NewChannel>("line");
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    api
      .get<{ ok: true; accounts: ChatAccount[] }>("/chat/accounts")
      .then((d) => setAccounts(d.accounts))
      .catch(() => setError("โหลดรายการบัญชีไม่สำเร็จ"));
  }
  useEffect(load, []);

  if (staff && !isOwner(staff)) return <Navigate to="/chat" replace />;

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const body =
        channel === "line"
          ? { channel, name, line_channel_secret: secret, line_access_token: token }
          : { channel, name, meta_page_token: token };
      const d = await api.post<{ ok: true; account: ChatAccount; warning?: string | null }>("/chat/accounts", body);
      setNotice(
        d.warning ??
          (channel === "line"
            ? `เพิ่ม "${d.account.name}" แล้ว — อย่าลืมเอา Webhook URL ด้านล่างไปใส่ใน LINE Developers`
            : `เพิ่ม "${d.account.name}" แล้ว`)
      );
      setName("");
      setSecret("");
      setToken("");
      setAdding(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "เพิ่มบัญชีไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(a: ChatAccount) {
    await api.patch(`/chat/accounts/${a.id}`, { is_active: !a.is_active });
    load();
  }

  async function handleDelete(a: ChatAccount) {
    if (!confirm(`ลบบัญชี "${a.name}"?\nแชทเก่ายังดูได้ แต่จะตอบกลับไม่ได้ และจะไม่รับข้อความใหม่จากบัญชีนี้`)) return;
    await api.delete(`/chat/accounts/${a.id}`);
    load();
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm";
  const labelClass = "mb-1 block text-sm text-gray-700";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">บัญชีแชท</h1>
        {!adding && (
          <button onClick={() => setAdding(true)} className="rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium text-white">
            + เพิ่มบัญชี
          </button>
        )}
      </div>

      {/* ปุ่ม "เชื่อมด้วย Facebook" ซ่อนไว้ก่อน: Meta App แบบ Business ที่ใช้อยู่เพิ่ม Facebook Login ไม่ได้
          ถ้าวันหลังสร้าง Meta App สำหรับล็อกอินแยก ค่อยเปิด (ตั้ง VITE_FB_CONNECT=1 ตอน build) */}
      {import.meta.env.VITE_FB_CONNECT === "1" && <FacebookConnectCard onDone={load} />}

      {notice && <p className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      {error && <p className="mb-3 text-sm text-brand-red">{error}</p>}

      {adding && (
        <form onSubmit={handleAdd} className="mb-4 space-y-3 rounded-xl border bg-white p-4">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {(["line", "messenger", "instagram"] as NewChannel[]).map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setChannel(c)}
                className={`flex-1 rounded-md py-1.5 text-xs font-medium ${channel === c ? "bg-white text-brand-navy shadow-sm" : "text-gray-500"}`}
              >
                {CHANNEL_LABELS[c]}
              </button>
            ))}
          </div>

          <label className="block">
            <span className={labelClass}>ชื่อที่ทีมเห็น (ไม่ใส่ก็ได้ ระบบจะใช้ชื่อจริงของบัญชี)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={inputClass} placeholder="เช่น LINE สาขาหลัก" />
          </label>

          {channel === "line" && (
            <label className="block">
              <span className={labelClass}>Channel secret</span>
              <input value={secret} onChange={(e) => setSecret(e.target.value)} required className={inputClass} autoComplete="off" />
            </label>
          )}
          <label className="block">
            <span className={labelClass}>{channel === "line" ? "Channel access token" : "Page access token"}</span>
            <textarea value={token} onChange={(e) => setToken(e.target.value)} required rows={3} className={`${inputClass} font-mono text-xs`} />
          </label>
          {channel === "instagram" && (
            <p className="text-xs text-gray-500">ใช้ Page access token ของเพจ Facebook ที่ผูกกับ IG นี้</p>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-brand-navy py-2 text-sm font-medium text-white disabled:opacity-50">
              {saving ? "กำลังตรวจสอบ..." : "เพิ่มบัญชี"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="rounded-lg border px-4 text-sm text-gray-600">
              ยกเลิก
            </button>
          </div>
        </form>
      )}

      {accounts && accounts.length === 0 && !adding && <p className="text-gray-500">ยังไม่มีบัญชี — กด "เพิ่มบัญชี" เพื่อเริ่ม</p>}

      <div className="space-y-2">
        {accounts?.map((a) => (
          <div key={a.id} className={`rounded-xl border bg-white p-4 ${a.is_active ? "" : "opacity-60"}`}>
            <div className="flex items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${CHANNEL_COLORS[a.channel]}`}>{CHANNEL_LABELS[a.channel]}</span>
              <span className="flex-1 truncate font-medium text-gray-900">{a.name}</span>
              {!a.is_active && <span className="text-xs text-gray-500">ปิดอยู่</span>}
            </div>
            {a.channel === "line" && <WebhookUrl path={a.webhook_path} />}
            <div className="mt-3 flex gap-2">
              <button onClick={() => toggleActive(a)} className="rounded-lg border px-3 py-1 text-xs text-gray-700">
                {a.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
              </button>
              <button onClick={() => handleDelete(a)} className="rounded-lg border border-brand-red px-3 py-1 text-xs text-brand-red">
                ลบ
              </button>
            </div>
          </div>
        ))}
      </div>

      {accounts?.some((a) => a.channel !== "line") && (
        <div className="mt-4 rounded-xl border bg-white p-4">
          <div className="mb-1 text-sm font-medium text-gray-900">Webhook ของ Messenger / Instagram (ใช้ร่วมกันทุกเพจ)</div>
          <WebhookUrl path="/api/chat/meta/webhook" />
        </div>
      )}
    </div>
  );
}

function WebhookUrl({ path }: { path: string }) {
  const url = `${window.location.origin}${path}`;
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg bg-gray-50 p-2">
      <code className="min-w-0 flex-1 break-all text-[11px] text-gray-600">{url}</code>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="flex-shrink-0 rounded-md bg-brand-navy px-2 py-1 text-[11px] text-white"
      >
        {copied ? "คัดลอกแล้ว" : "คัดลอก"}
      </button>
    </div>
  );
}
