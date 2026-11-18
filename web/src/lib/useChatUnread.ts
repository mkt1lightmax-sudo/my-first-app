import { useEffect, useRef, useState } from "react";
import { api } from "./api";

const POLL_MS = 15000;
const BASE_TITLE = "LIGHTMAX SOLAR";

// เสียง "ติ๊ง" สั้นๆ สร้างจากเบราว์เซอร์เอง (ไม่ต้องมีไฟล์เสียง)
// เบราว์เซอร์อนุญาตให้เล่นเสียงได้หลังผู้ใช้แตะหน้าจอ/คลิกอย่างน้อยหนึ่งครั้ง
let audioCtx: AudioContext | null = null;
function playDing() {
  try {
    audioCtx = audioCtx ?? new AudioContext();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.25, t + i * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.35);
      osc.connect(gain).connect(audioCtx!.destination);
      osc.start(t + i * 0.12);
      osc.stop(t + i * 0.12 + 0.4);
    });
  } catch {
    // บางเบราว์เซอร์ไม่รองรับ — ไม่เป็นไร
  }
}

const SOUND_KEY = "chat-sound";
export function isChatSoundOn() {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}
export function setChatSound(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // ไม่เป็นไร
  }
}

// จำนวนแชทที่ยังไม่อ่าน: แสดงที่แท็บ "แชท" + ชื่อแท็บเบราว์เซอร์ + เล่นเสียงเมื่อลูกค้าทักใหม่
export function useChatUnread(enabled: boolean) {
  const [unread, setUnread] = useState(0);
  const lastSeen = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;

    function load() {
      api
        .get<{ ok: true; unread: number; latest: string | null }>("/chat/unread-count")
        .then((d) => {
          if (!alive) return;
          setUnread(d.unread);
          // ข้อความลูกค้าใหม่กว่าที่เคยเห็น → เล่นเสียง (ไม่เล่นตอนโหลดครั้งแรก)
          if (lastSeen.current && d.latest && d.latest > lastSeen.current && isChatSoundOn()) playDing();
          if (d.latest) lastSeen.current = d.latest;
          else if (!lastSeen.current) lastSeen.current = new Date(0).toISOString();
        })
        .catch(() => {});
    }

    load();
    const interval = setInterval(load, POLL_MS);
    // กลับมาที่แท็บ/แอป → อัปเดตทันที
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);

  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) ${BASE_TITLE}` : BASE_TITLE;
  }, [unread]);

  return unread;
}
