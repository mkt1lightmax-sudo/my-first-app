import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";

type PendingPage = {
  id: string;
  name: string;
  added: boolean;
  instagram: { id: string; username: string | null; added: boolean } | null;
};

// การ์ด "เชื่อมเพจด้วย Facebook": กดแล้วไปล็อกอิน Facebook → กลับมาเลือกเพจ/IG → ระบบเพิ่มให้เอง (ไม่ต้องคัดลอก token)
export default function FacebookConnectCard({ onDone }: { onDone: () => void }) {
  const [params, setParams] = useSearchParams();
  const pendingId = params.get("connect");
  const connectError = params.get("connect_error");

  const [info, setInfo] = useState<{ ready: boolean; redirectUri: string } | null>(null);
  const [pages, setPages] = useState<PendingPage[] | null>(null);
  const [fb, setFb] = useState<Set<string>>(new Set());
  const [ig, setIg] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get<{ ok: true; ready: boolean; redirectUri: string }>("/chat/accounts/meta/info").then(setInfo).catch(() => {});
  }, []);

  // กลับมาจาก Facebook พร้อมรหัสรายการเพจ → โหลดรายชื่อเพจให้เลือก
  useEffect(() => {
    if (!pendingId) return;
    api
      .get<{ ok: true; pages: PendingPage[] }>(`/chat/accounts/meta/pending/${pendingId}`)
      .then((d) => {
        setPages(d.pages);
        setFb(new Set(d.pages.filter((p) => p.added).map((p) => p.id))); // ที่เคยเพิ่มแล้วติ๊กไว้ = อัปเดต token ให้ใหม่
        setIg(new Set(d.pages.filter((p) => p.instagram?.added).map((p) => p.id)));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "โหลดรายชื่อเพจไม่สำเร็จ"));
  }, [pendingId]);

  function clearParams() {
    params.delete("connect");
    params.delete("connect_error");
    setParams(params, { replace: true });
  }

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const d = await api.post<{ ok: true; results: { name: string; warning: string | null }[] }>(
        `/chat/accounts/meta/pending/${pendingId}`,
        { messenger: [...fb], instagram: [...ig] }
      );
      const warn = d.results.filter((r) => r.warning);
      setDone(
        `เชื่อมแล้ว: ${d.results.map((r) => r.name).join(", ")}` +
          (warn.length ? ` — แต่สมัครรับข้อความอัตโนมัติไม่สำเร็จ: ${warn.map((r) => `${r.name} (${r.warning})`).join("; ")}` : "")
      );
      setPages(null);
      clearParams();
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "เชื่อมไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  // ---- กำลังเลือกเพจหลังกลับจาก Facebook ----
  if (pendingId && (pages || error)) {
    return (
      <div className="mb-4 rounded-2xl border-2 border-[#1877F2]/30 bg-white p-4">
        <h2 className="mb-1 text-base font-semibold text-gray-900">เลือกเพจที่จะรับแชทเข้าแอป</h2>
        <p className="mb-3 text-xs text-gray-500">ติ๊กเพจ (Messenger) และ IG ที่ผูกกับเพจ ที่ต้องการให้แชทเข้ามา</p>
        {error && <p className="mb-3 text-sm text-brand-red">{error}</p>}
        <div className="space-y-2">
          {pages?.map((p) => (
            <div key={p.id} className="rounded-xl bg-gray-50 p-3">
              <Check checked={fb.has(p.id)} onChange={() => toggle(fb, setFb, p.id)}>
                <span className="font-medium text-gray-900">{p.name}</span>
                <span className="ml-1.5 rounded bg-[#0084FF] px-1.5 py-0.5 text-[10px] font-medium text-white">Messenger</span>
                {p.added && <span className="ml-1.5 text-[11px] text-gray-400">(เชื่อมไว้แล้ว — จะอัปเดตให้)</span>}
              </Check>
              {p.instagram && (
                <Check checked={ig.has(p.id)} onChange={() => toggle(ig, setIg, p.id)} className="mt-2 pl-6">
                  <span className="text-gray-800">IG @{p.instagram.username || p.instagram.id}</span>
                  <span className="ml-1.5 rounded bg-[#E1306C] px-1.5 py-0.5 text-[10px] font-medium text-white">Instagram</span>
                  {p.instagram.added && <span className="ml-1.5 text-[11px] text-gray-400">(เชื่อมไว้แล้ว)</span>}
                </Check>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={save}
            disabled={saving || (!fb.size && !ig.size)}
            className="flex-1 rounded-xl bg-[#1877F2] py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {saving ? "กำลังเชื่อม..." : `เชื่อม ${fb.size + ig.size} บัญชี`}
          </button>
          <button onClick={() => (setPages(null), setError(null), clearParams())} className="rounded-xl px-4 text-sm text-gray-600 ring-1 ring-gray-200">
            ยกเลิก
          </button>
        </div>
      </div>
    );
  }

  // ---- ปุ่มเริ่มเชื่อม ----
  return (
    <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      {done && <p className="mb-3 rounded-xl bg-green-50 p-3 text-sm text-green-800">{done}</p>}
      {connectError && (
        <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-brand-red">
          {connectError}{" "}
          <button onClick={clearParams} className="underline">
            ปิด
          </button>
        </p>
      )}
      <a
        href={info?.ready ? "/api/chat/accounts/meta/connect" : undefined}
        aria-disabled={!info?.ready}
        className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white ${
          info?.ready ? "bg-[#1877F2] active:opacity-90" : "pointer-events-none bg-gray-300"
        }`}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-[#1877F2]">f</span>
        เชื่อมเพจ / IG ด้วย Facebook
      </a>
      <p className="mt-2 text-xs text-gray-500">ล็อกอิน Facebook แล้วเลือกเพจ — ระบบเพิ่มให้เอง ไม่ต้องคัดลอก token</p>

      {info && (
        <details className="mt-3 text-xs text-gray-500" open={!info.ready}>
          <summary className="cursor-pointer">ตั้งค่าครั้งแรก (Meta App)</summary>
          {!info.ready && <p className="mt-2 text-brand-red">ยังไม่ได้ใส่ META_APP_ID ใน Vercel — ปุ่มจะกดได้หลังตั้งค่า</p>}
          <p className="mt-2">ใส่ลิงก์นี้ใน Meta App → Facebook Login → Settings → Valid OAuth Redirect URIs:</p>
          <div className="mt-1 flex items-center gap-2 rounded-lg bg-gray-50 p-2">
            <code className="min-w-0 flex-1 break-all text-[11px] text-gray-700">{info.redirectUri}</code>
            <button
              onClick={() =>
                navigator.clipboard?.writeText(info.redirectUri).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                })
              }
              className="flex-shrink-0 rounded-md bg-brand-navy px-2 py-1 text-[11px] text-white"
            >
              {copied ? "คัดลอกแล้ว" : "คัดลอก"}
            </button>
          </div>
        </details>
      )}
    </div>
  );
}

function Check({
  checked,
  onChange,
  className = "",
  children,
}: {
  checked: boolean;
  onChange: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex cursor-pointer items-center gap-2 text-sm ${className}`}>
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 flex-shrink-0 accent-[#1877F2]" />
      <span className="min-w-0">{children}</span>
    </label>
  );
}
