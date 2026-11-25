import { useState, type ReactNode } from "react";
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
      // Facebook บางครั้งส่งมาเป็นลิงก์แผนที่แทนพิกัด
      if (m.meta?.url) {
        return (
          <a
            href={m.meta.url}
            target="_blank"
            rel="noreferrer"
            className={`block underline-offset-2 hover:underline ${out ? "text-white" : "text-brand-navy"}`}
          >
            📍 {m.meta.title || "ตำแหน่งที่ตั้ง"}
            <span className="mt-0.5 block text-xs opacity-70">เปิดแผนที่ ›</span>
          </a>
        );
      }
      return <span>{m.text}</span>;

    default:
      if (m.meta?.emojis?.length && m.text) return <TextWithLineEmoji text={m.text} emojis={m.meta.emojis} out={out} />;
      return <LinkifiedText text={m.text} out={out} />;
  }
}

// แทนที่ข้อความ "(emoji)" ด้วยรูปอีโมจิจริงของ LINE (ดึงจาก CDN สาธารณะของ LINE)
type LineEmoji = { index: number; length: number; productId: string; emojiId: string };
function TextWithLineEmoji({ text, emojis, out }: { text: string; emojis: LineEmoji[]; out: boolean }) {
  const sorted = [...emojis].sort((a, b) => a.index - b.index);
  const parts: ReactNode[] = [];
  let pos = 0;
  sorted.forEach((e, i) => {
    if (e.index < pos) return;
    if (e.index > pos) parts.push(<LinkifiedText key={`t${i}`} text={text.slice(pos, e.index)} out={out} />);
    parts.push(
      <img
        key={`e${i}`}
        src={`https://stickershop.line-scdn.net/sticonshop/v1/sticon/${encodeURIComponent(e.productId)}/iPhone/${encodeURIComponent(e.emojiId)}.png`}
        alt={text.slice(e.index, e.index + e.length)}
        className="inline-block h-6 w-6 align-text-bottom"
      />
    );
    pos = e.index + e.length;
  });
  if (pos < text.length) parts.push(<LinkifiedText key="end" text={text.slice(pos)} out={out} />);
  return <span>{parts}</span>;
}

// ทำให้ลิงก์ในข้อความกดได้ (http/https และ www.)
const URL_RE = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
function LinkifiedText({ text, out }: { text: string | null; out: boolean }) {
  if (!text) return null;
  const parts = text.split(URL_RE);
  return (
    <span>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part;
        // ตัดเครื่องหมายวรรคตอนท้ายลิงก์ออก เช่น "ดูที่ https://x.com)."
        const trail = part.match(/[).,!?:;]+$/)?.[0] ?? "";
        const url = trail ? part.slice(0, -trail.length) : part;
        const href = url.startsWith("www.") ? `https://${url}` : url;
        return (
          <span key={i}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`break-all underline underline-offset-2 ${out ? "text-white" : "text-blue-600"}`}
            >
              {url}
            </a>
            {trail}
          </span>
        );
      })}
    </span>
  );
}

function ChatImage({ src }: { src: string }) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [zoom, setZoom] = useState(false);
  const [fullWidth, setFullWidth] = useState(false);

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
          <div className="flex flex-shrink-0 items-center justify-between gap-4 p-4 text-sm text-white">
            <span className="text-white/60">{fullWidth ? "แตะรูปเพื่อย่อให้พอดีจอ" : "แตะรูปเพื่อขยายเต็มความกว้าง"}</span>
            <div className="flex gap-4">
              <a href={src} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="underline">
                เปิดในแท็บใหม่
              </a>
              <button onClick={() => setZoom(false)}>ปิด ✕</button>
            </div>
          </div>
          {/* min-h-0 = กล่องนี้สูงไม่เกินจอ รูปจึงย่อพอดีจอ (เอกสารแนวตั้งยาวๆ ไม่ล้น) / แตะรูป = ขยายเต็มความกว้างแล้วเลื่อนดู */}
          <div className={`min-h-0 flex-1 overflow-auto p-4 ${fullWidth ? "" : "flex items-center justify-center"}`}>
            <img
              src={src}
              alt="รูปขนาดเต็ม"
              onClick={(e) => {
                e.stopPropagation();
                setFullWidth((v) => !v);
              }}
              className={fullWidth ? "mx-auto h-auto w-full max-w-3xl cursor-zoom-out" : "max-h-full max-w-full cursor-zoom-in object-contain"}
            />
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
