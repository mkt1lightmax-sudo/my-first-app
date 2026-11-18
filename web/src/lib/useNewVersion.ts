import { useEffect, useState } from "react";

// เช็กว่ามีแอปเวอร์ชันใหม่ขึ้นเว็บแล้วหรือยัง (เทียบชื่อไฟล์ JS หลักที่ Vite ใส่รหัสไว้ เช่น /assets/index-AbC123.js)
// เช็กตอนกลับมาเปิดแอป และทุก 5 นาที — ถ้าไม่ตรงกับที่เปิดอยู่ = มีเวอร์ชันใหม่
const CHECK_MS = 5 * 60 * 1000;
const ASSET_RE = /\/assets\/index-[\w-]+\.js/;

function currentAsset() {
  const s = [...document.querySelectorAll<HTMLScriptElement>("script[src]")].find((el) => ASSET_RE.test(el.src));
  return s ? s.src.match(ASSET_RE)?.[0] ?? null : null;
}

export function useNewVersion() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const mine = currentAsset();
    if (import.meta.env.DEV || !mine) return; // ตอนพัฒนาในเครื่องไม่ต้องเช็ก

    let stopped = false;
    async function check() {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const html = await fetch("/", { cache: "no-store" }).then((r) => r.text());
        const latest = html.match(ASSET_RE)?.[0];
        if (latest && latest !== mine) setAvailable(true);
      } catch {
        // ออฟไลน์ชั่วคราว — ไว้เช็กรอบหน้า
      }
    }

    const interval = setInterval(check, CHECK_MS);
    const onVisible = () => check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stopped = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return available;
}
