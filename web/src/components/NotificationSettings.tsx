import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { disablePush, enablePush, getCurrentSubscription, isIOS, isStandalone, pushSupported } from "../lib/push";
import { isChatSoundOn, setChatSound } from "../lib/useChatUnread";

// กล่องตั้งค่าแจ้งเตือนในเมนูโปรไฟล์: แจ้งเตือนเด้ง (เครื่องนี้) + เสียงเตือนในแอป
export default function NotificationSettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [sound, setSound] = useState(isChatSoundOn());

  const supported = pushSupported();
  const needsHomeScreen = isIOS() && !isStandalone();

  useEffect(() => {
    if (!supported) return setEnabled(false);
    getCurrentSubscription()
      .then((s) => setEnabled(Boolean(s) && Notification.permission === "granted"))
      .catch(() => setEnabled(false));
  }, [supported]);

  async function toggle() {
    setBusy(true);
    setMsg(null);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
        setMsg({ text: "ปิดแจ้งเตือนเครื่องนี้แล้ว" });
      } else {
        await enablePush();
        setEnabled(true);
        setMsg({ text: "เปิดแจ้งเตือนแล้ว ✓ ลองกด \"ทดสอบ\"" });
      }
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "ทำรายการไม่สำเร็จ", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setMsg(null);
    try {
      await api.post("/push/test");
      setMsg({ text: "ส่งแล้ว — ควรเด้งภายในไม่กี่วินาที" });
    } catch (err) {
      setMsg({ text: err instanceof ApiError ? err.message : "ส่งไม่สำเร็จ", error: true });
    }
  }

  return (
    <div className="mt-3 rounded-xl bg-gray-50 p-3">
      <div className="mb-2 text-xs font-semibold text-gray-500">แจ้งเตือนแชท</div>

      {needsHomeScreen ? (
        <p className="text-xs leading-relaxed text-gray-600">
          iPhone: กดปุ่มแชร์ <span aria-hidden>⬆️</span> → <b>เพิ่มไปยังหน้าจอโฮม</b> แล้วเปิดแอปจากไอคอนนั้น จึงจะเปิดแจ้งเตือนได้
        </p>
      ) : !supported ? (
        <p className="text-xs text-gray-500">เบราว์เซอร์นี้ไม่รองรับแจ้งเตือนเด้ง</p>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-gray-700">แจ้งเตือนเด้ง (เครื่องนี้)</span>
          <Switch on={!!enabled} disabled={busy || enabled === null} onClick={toggle} />
        </div>
      )}
      {enabled && (
        <button onClick={test} className="mt-2 text-xs font-medium text-brand-navy underline-offset-2 hover:underline">
          ทดสอบแจ้งเตือน
        </button>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-200 pt-2">
        <span className="text-sm text-gray-700">เสียงเมื่อมีแชทใหม่</span>
        <Switch
          on={sound}
          onClick={() => {
            setChatSound(!sound);
            setSound(!sound);
          }}
        />
      </div>

      {msg && <p className={`mt-2 text-xs ${msg.error ? "text-brand-red" : "text-emerald-700"}`}>{msg.text}</p>}
    </div>
  );
}

function Switch({ on, disabled, onClick }: { on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition disabled:opacity-50 ${on ? "bg-brand-navy" : "bg-gray-300"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}
