import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type StickerPackage = { packageId: number; first: number; last: number; name: string };
type Sticker = { packageId: number; stickerId: number };

const stickerImg = (id: number) => `https://stickershop.line-scdn.net/stickershop/v1/sticker/${id}/android/sticker.png`;

// "ใช้ล่าสุด" เก็บในเครื่องนี้ (ความสะดวกส่วนตัว — หายได้ไม่เป็นไร)
const RECENT_KEY = "recent-stickers";
const MAX_RECENT = 12;
function loadRecent(): Sticker[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(v) ? v.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}
export function rememberSticker(s: Sticker) {
  try {
    const next = [s, ...loadRecent().filter((r) => r.stickerId !== s.stickerId)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ไม่เป็นไร
  }
}

let cachedPackages: StickerPackage[] | null = null;

// แผงเลือกสติกเกอร์ (เลื่อนขึ้นจากด้านล่าง) — แตะสติกเกอร์ = ส่งทันที
export default function StickerPicker({
  sending,
  onPick,
  onClose,
}: {
  sending: boolean;
  onPick: (s: Sticker) => void;
  onClose: () => void;
}) {
  const [packages, setPackages] = useState<StickerPackage[] | null>(cachedPackages);
  const [recent] = useState<Sticker[]>(loadRecent);
  const [tab, setTab] = useState<number | "recent">(recent.length ? "recent" : 0);

  useEffect(() => {
    if (cachedPackages) return;
    api
      .get<{ ok: true; packages: StickerPackage[] }>("/chat/stickers")
      .then((d) => {
        cachedPackages = d.packages;
        setPackages(d.packages);
        if (!recent.length) setTab(d.packages[0]?.packageId ?? 0);
      })
      .catch(() => setPackages([]));
  }, [recent.length]);

  const current = packages?.find((p) => p.packageId === tab);
  const stickers: Sticker[] =
    tab === "recent"
      ? recent
      : current
        ? Array.from({ length: current.last - current.first + 1 }, (_, i) => ({ packageId: current.packageId, stickerId: current.first + i }))
        : [];

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative flex h-[55vh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <span className="text-sm font-semibold text-gray-900">สติกเกอร์</span>
          <span className="h-1 w-10 rounded-full bg-gray-200" />
          <button onClick={onClose} className="text-sm text-gray-500">
            ปิด
          </button>
        </div>

        {/* แท็บชุดสติกเกอร์ */}
        <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-gray-100 px-3 pb-2 pt-1">
          {recent.length > 0 && (
            <TabButton active={tab === "recent"} onClick={() => setTab("recent")} label="ใช้ล่าสุด">
              <span className="text-lg">🕘</span>
            </TabButton>
          )}
          {packages?.map((p) => (
            <TabButton key={p.packageId} active={tab === p.packageId} onClick={() => setTab(p.packageId)} label={p.name}>
              <img src={stickerImg(p.first)} alt="" loading="lazy" className="h-8 w-8 object-contain" />
            </TabButton>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {!packages && <p className="py-8 text-center text-sm text-gray-400">กำลังโหลด...</p>}
          <div className="grid grid-cols-4 gap-2">
            {stickers.map((s) => (
              <button
                key={`${s.packageId}-${s.stickerId}`}
                onClick={() => onPick(s)}
                disabled={sending}
                className="flex aspect-square items-center justify-center rounded-2xl p-1.5 transition active:scale-95 active:bg-gray-100 disabled:opacity-40"
                aria-label="ส่งสติกเกอร์"
              >
                <img src={stickerImg(s.stickerId)} alt="" loading="lazy" className="h-full w-full object-contain" />
              </button>
            ))}
          </div>
        </div>
        <p className="border-t border-gray-100 px-4 py-2 text-center text-[11px] text-gray-400">
          {sending ? "กำลังส่ง..." : "แตะเพื่อส่งทันที · LINE อนุญาตให้ OA ส่งได้เฉพาะชุดเหล่านี้"}
        </p>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition ${active ? "bg-brand-navy/10 ring-1 ring-brand-navy/30" : ""}`}
    >
      {children}
    </button>
  );
}
