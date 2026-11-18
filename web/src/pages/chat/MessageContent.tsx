import { useState } from "react";
import type { ChatMessage } from "../../lib/chat";

// แสดงเนื้อหาข้อความตามชนิด: ข้อความ / รูป / สติกเกอร์ / วิดีโอ / เสียง / ไฟล์ / แผนที่
// ไฟล์จริงดึงผ่าน /api/chat/messages/:id/content (เซิร์ฟเวอร์เราไปดึงจาก LINE / Meta ให้)

// รูปที่เราส่งเอง เก็บไว้ที่ /api/chat/media/<token>; รูปจากลูกค้าดึงผ่าน /api/chat/messages/:id/content
const mediaUrl = (m: ChatMessage) =>
  m.meta?.mediaToken ? `/api/chat/media/${m.meta.mediaToken}` : `/api/chat/messages/${m.id}/content`;

// สติกเกอร์ LINE ดึงรูปจาก CDN สาธารณะของ LINE ได้ด้วยรหัสสติกเกอร์
function lineStickerUrl(m: ChatMessage) {
  const id = m.meta?.stickerId;
  if (!id) return null;
  return `https://stickershop.line-scdn.net/stickershop/v1/sticker/${id}/android/sticker.png`;
}

/** true = แสดงแบบไม่มีกรอบ bubble (รูป/สติกเกอร์) */
export function isBareMedia(m: ChatMessage) {
  if (m.message_type === "image") return true;
  if (m.message_type === "sticker") return Boolean(lineStickerUrl(m) || m.meta?.url);
  return false;
}

export default function MessageContent({ m, out }: { m: ChatMessage; out: boolean }) {
  switch (m.message_type) {
    case "image":
      return <ChatImage src={mediaUrl(m)} />;

    case "sticker": {
      const src = lineStickerUrl(m) || m.meta?.url;
      if (!src) return <span>{m.text}</span>;
      return <img src={src} alt="สติกเกอร์" loading="lazy" className="h-28 w-28 object-contain" />;
    }

    case "video":
      return <video src={mediaUrl(m)} controls preload="metadata" className="max-h-72 w-64 max-w-full rounded-xl bg-black" />;

    case "audio":
      return <audio src={mediaUrl(m)} controls preload="none" className="w-60 max-w-full" />;

    case "file":
      return (
        <a
          href={mediaUrl(m)}
          target="_blank"
          rel="noreferrer"
          className={`flex items-center gap-2 underline-offset-2 hover:underline ${out ? "text-white" : "text-brand-navy"}`}
        >
          <span aria-hidden>📄</span>
          <span className="break-all">{m.meta?.fileName || "ไฟล์แนบ"}</span>
          {m.meta?.fileSize ? <span className="opacity-60">({formatSize(m.meta.fileSize)})</span> : null}
        </a>
      );

    case "location":
      if (m.meta?.latitude != null && m.meta?.longitude != null) {
        return (
          <a
            href={`https://www.google.com/maps?q=${m.meta.latitude},${m.meta.longitude}`}
            target="_blank"
            rel="noreferrer"
            className={`block underline-offset-2 hover:underline ${out ? "text-white" : "text-brand-navy"}`}
          >
            📍 {m.meta.title || m.meta.address || "ตำแหน่งที่ตั้ง"}
            {m.meta.title && m.meta.address ? <span className="block text-xs opacity-70">{m.meta.address}</span> : null}
            <span className="mt-0.5 block text-xs opacity-70">เปิดใน Google Maps ›</span>
          </a>
        );
      }
      return <span>{m.text}</span>;

    default:
      return <span>{m.text}</span>;
  }
}

function ChatImage({ src }: { src: string }) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [zoom, setZoom] = useState(false);

  if (state === "error") {
    return (
      <div className="flex h-24 w-48 items-center justify-center rounded-2xl bg-gray-100 px-3 text-center text-xs text-gray-500 ring-1 ring-gray-200">
        เปิดรูปไม่ได้ (LINE เก็บรูปไว้ให้ระยะหนึ่ง รูปนี้อาจหมดอายุแล้ว)
      </div>
    );
  }

  return (
    <>
      <button onClick={() => setZoom(true)} className="block overflow-hidden rounded-2xl ring-1 ring-gray-200" aria-label="ดูรูปขนาดเต็ม">
        {/* ไม่ใช้ loading="lazy" + display:none ร่วมกัน เพราะเบราว์เซอร์จะไม่โหลดรูปที่ถูกซ่อน */}
        {state === "loading" && <div className="h-48 w-48 animate-pulse bg-gray-200" />}
        <img
          src={src}
          alt="รูปจากลูกค้า"
          onLoad={() => setState("ok")}
          onError={() => setState("error")}
          className={`max-h-72 w-auto max-w-[16rem] object-cover ${state === "loading" ? "absolute h-px w-px opacity-0" : ""}`}
        />
      </button>
      {zoom && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90" onClick={() => setZoom(false)}>
          <div className="flex justify-end gap-4 p-4 text-sm text-white">
            <a href={src} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="underline">
              เปิดในแท็บใหม่
            </a>
            <button onClick={() => setZoom(false)}>ปิด ✕</button>
          </div>
          <div className="flex flex-1 items-center justify-center p-4">
            <img src={src} alt="รูปขนาดเต็ม" className="max-h-full max-w-full object-contain" />
          </div>
        </div>
      )}
    </>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
