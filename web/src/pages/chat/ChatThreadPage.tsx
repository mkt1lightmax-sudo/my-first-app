import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { CHANNEL_LABELS, formatBaht, metaReplyHoursLeft, ticketNumber, type ChatMessage, type Conversation } from "../../lib/chat";
import TicketDetailsSheet from "./TicketDetailsSheet";
import CustomerInfoCard from "./CustomerInfoCard";
import StickerPicker, { rememberSticker } from "./StickerPicker";
import MessageContent, { isBareMedia } from "./MessageContent";
import { Avatar } from "./ChatListPage";
import CustomerPanel from "./CustomerPanel";
import { useAuth } from "../../context/AuthContext";
import { can, isOwner } from "../../lib/permissions";
import DeleteCustomerSheet from "./DeleteCustomerSheet";
import { BookmarkIcon, CheckCircleIcon, ChevronLeftIcon, ImageIcon, MoreIcon, SendIcon } from "../../components/icons";
import { blobToBase64, prepareImage, type PreparedImage } from "../../lib/imageResize";

export default function ChatThreadPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { staff: me } = useAuth();
  const canReply = can(me, "chat.reply");
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<PreparedImage | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null); // กล่องที่เลื่อนดูข้อความ
  const contentRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);
  const stickToBottom = useRef(true); // ผู้ใช้อยู่ล่างสุดอยู่ไหม (ถ้าเลื่อนขึ้นไปอ่านของเก่า จะไม่ดึงลงเอง)

  function load() {
    return api
      .get<{ ok: true; conversation: Conversation; messages: ChatMessage[] }>(`/chat/conversations/${id}/messages`)
      .then((data) => {
        setConversation(data.conversation);
        setMessages(data.messages);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "โหลดแชทไม่สำเร็จ"));
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000); // เช็กข้อความใหม่ทุก 5 วินาที
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // เปลี่ยนห้องแชท → เริ่มใหม่ที่ล่างสุด
  useEffect(() => {
    lastCount.current = 0;
    stickToBottom.current = true;
  }, [id]);

  // เลื่อนลงล่างสุดเมื่อมีข้อความใหม่ — เลื่อนเฉพาะกล่องข้อความ ไม่ให้ทั้งหน้ากระโดด
  // เปิดแชทครั้งแรก: ไปล่างสุดทันทีไม่ต้องเลื่อนแบบแอนิเมชัน
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || messages.length === lastCount.current) return;
    const first = lastCount.current === 0;
    const mine = messages[messages.length - 1]?.direction === "out";
    lastCount.current = messages.length;
    if (first || mine || stickToBottom.current) {
      stickToBottom.current = true;
      el.scrollTo({ top: el.scrollHeight, behavior: first ? "auto" : "smooth" });
    }
  }, [messages]);

  // รูปโหลดเสร็จทีหลังทำให้ความสูงเปลี่ยน → ถ้าอยู่ล่างสุดอยู่แล้ว ให้ค้างไว้ล่างสุด
  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    const ro = new ResizeObserver(() => {
      if (stickToBottom.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  // แนบรูป: เลือก → ย่อในเครื่อง → ดูตัวอย่าง → ส่ง
  async function pickImage(file: File) {
    setError(null);
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      if (file.size > MAX_PDF_BYTES) {
        setError("ไฟล์ PDF ใหญ่เกิน 3MB — ลองบีบอัดไฟล์ก่อนส่ง");
        return;
      }
      setPendingFile(file);
      return;
    }
    try {
      setPending(await prepareImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "เปิดรูปไม่สำเร็จ");
    }
  }

  function cancelImage() {
    if (pending) URL.revokeObjectURL(pending.previewUrl);
    setPending(null);
    setError(null);
  }

  async function sendImage() {
    if (!pending || sending) return;
    setSending(true);
    setError(null);
    try {
      const data = await blobToBase64(pending.blob);
      const d = await api.post<{ ok: true; message: ChatMessage }>(`/chat/conversations/${id}/images`, {
        data,
        contentType: pending.contentType,
      });
      setMessages((prev) => [...prev, d.message]);
      URL.revokeObjectURL(pending.previewUrl);
      setPending(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ส่งรูปไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  }

  async function sendFile() {
    if (!pendingFile || sending) return;
    setSending(true);
    setError(null);
    try {
      const data = await blobToBase64(pendingFile);
      const d = await api.post<{ ok: true; message: ChatMessage }>(`/chat/conversations/${id}/files`, {
        data,
        fileName: pendingFile.name,
      });
      setMessages((prev) => [...prev, d.message]);
      setPendingFile(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ส่งไฟล์ไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  }

  async function sendSticker(s: { packageId: number; stickerId: number }) {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const d = await api.post<{ ok: true; message: ChatMessage }>(`/chat/conversations/${id}/stickers`, s);
      setMessages((prev) => [...prev, d.message]);
      rememberSticker(s);
      setStickerOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ส่งสติกเกอร์ไม่สำเร็จ");
      setStickerOpen(false);
    } finally {
      setSending(false);
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setError(null);
    try {
      const data = await api.post<{ ok: true; message: ChatMessage }>(`/chat/conversations/${id}/messages`, { text: value });
      setMessages((prev) => [...prev, data.message]);
      setText("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ส่งข้อความไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  }

  // ปุ่มจัดการทิกเก็ต (ปิด / เปิดใหม่ / สแปม / ติดตาม)
  async function action(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    setMenuOpen(false);
    try {
      const d = await api.post<{ ok: true; conversation?: Conversation }>(`/chat/conversations/${id}/${path}`, body);
      if (d.conversation) setConversation(d.conversation);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ทำรายการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function markUnread() {
    setMenuOpen(false);
    try {
      await api.post(`/chat/conversations/${id}/unread`);
      navigate("/chat");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ทำรายการไม่สำเร็จ");
    }
  }

  const hoursLeft = conversation ? metaReplyHoursLeft(conversation) : null;
  const closed = conversation?.status === "closed";

  return (
    <div className="-mx-4 -my-5 flex h-[calc(100dvh-7.5rem)] flex-col bg-gray-50">
      {/* หัวแชท */}
      <div className="relative flex items-center gap-2 border-b border-gray-100 bg-white px-2 py-2">
        <Link to="/chat" className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 active:bg-gray-100" aria-label="กลับ">
          <ChevronLeftIcon className="h-6 w-6" />
        </Link>
        <Avatar url={conversation?.picture_url ?? null} channel={conversation?.channel} size="h-10 w-10" />
        <div className="min-w-0 flex-1 pl-1">
          <div className="truncate text-[15px] font-semibold text-gray-900">{conversation?.display_name || "ลูกค้า"}</div>
          {conversation && (
            <div className="truncate text-xs text-gray-500">
              {CHANNEL_LABELS[conversation.channel]}
              {conversation.account_name ? ` · ${conversation.account_name}` : ""}
            </div>
          )}
        </div>

        {conversation && (
          <>
            <HeaderButton
              label={conversation.followed ? "เลิกติดตาม" : "ติดตาม"}
              onClick={() => action("follow", { follow: !conversation.followed })}
              disabled={busy}
            >
              <BookmarkIcon filled={conversation.followed} className={`h-5 w-5 ${conversation.followed ? "text-amber-500" : ""}`} />
            </HeaderButton>
            {canReply && !closed && (
              <button
                onClick={() => action("close")}
                disabled={busy}
                className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 disabled:opacity-50"
              >
                <CheckCircleIcon className="h-4 w-4" />
                ปิดทิกเก็ต
              </button>
            )}
            {canReply && (
              <HeaderButton label="เพิ่มเติม" onClick={() => setMenuOpen((v) => !v)}>
                <MoreIcon className="h-5 w-5" />
              </HeaderButton>
            )}
          </>
        )}

        {menuOpen && conversation && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-2 top-14 z-30 w-60 overflow-hidden rounded-2xl bg-white py-1 shadow-xl ring-1 ring-gray-100">
              <MenuItem onClick={markUnread}>ทำเครื่องหมายว่ายังไม่อ่าน</MenuItem>
              {closed && <MenuItem onClick={() => action("reopen")}>เปิดทิกเก็ตอีกครั้ง</MenuItem>}
              <MenuItem danger={!conversation.is_spam} onClick={() => action("spam", { spam: !conversation.is_spam })}>
                {conversation.is_spam ? "ไม่ใช่สแปม" : "ทำเครื่องหมายว่าเป็นสแปม"}
              </MenuItem>
              {isOwner(me) && (
                <MenuItem
                  danger
                  onClick={() => {
                    setMenuOpen(false);
                    setDeleteOpen(true);
                  }}
                >
                  ลบข้อมูลลูกค้านี้ทั้งหมด…
                </MenuItem>
              )}
            </div>
          </>
        )}
      </div>

      {conversation && <CustomerPanel conversation={conversation} onChange={setConversation} />}
      {conversation && <CustomerInfoCard conversation={conversation} canEdit={canReply} onChange={setConversation} />}
      {conversation && (
        <button
          onClick={() => setTicketOpen(true)}
          className="flex items-center gap-2 border-b border-gray-100 bg-white px-4 py-2.5 text-left active:bg-gray-50"
        >
          <span className="font-mono text-xs text-gray-500">{ticketNumber(conversation)}</span>
          {conversation.deal_amount !== null && (
            <span className="text-sm font-semibold text-gray-900">{formatBaht(conversation.deal_amount)}</span>
          )}
          {conversation.deal_outcome && (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                conversation.deal_outcome === "won" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-red-50 text-brand-red ring-1 ring-red-200"
              }`}
            >
              {conversation.deal_outcome === "won" ? "ปิดการขายได้" : "ปิดการขายไม่ได้"}
            </span>
          )}
          <span className="ml-auto text-xs text-brand-navy">
            {conversation.deal_amount === null && !conversation.deal_outcome && canReply ? "+ ยอดขาย" : "รายละเอียดทิกเก็ต"} ›
          </span>
        </button>
      )}
      {ticketOpen && conversation && (
        <TicketDetailsSheet
          conversation={conversation}
          canEdit={canReply}
          onSaved={(c) => {
            setConversation(c);
            setTicketOpen(false);
            load();
          }}
          onClose={() => setTicketOpen(false)}
        />
      )}
      {conversation?.is_spam && <div className="bg-amber-50 px-4 py-2 text-xs text-amber-800">แชทนี้ถูกทำเครื่องหมายว่าเป็นสแปม</div>}

      {/* ข้อความ */}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex-1 overflow-y-auto overscroll-contain px-3 py-4"
      >
        <div ref={contentRef}>
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
          return (
            <div key={m.id}>
              {newDay && <DateDivider iso={m.created_at} />}
              <MessageBubble m={m} />
            </div>
          );
        })}
        </div>
      </div>

      {hoursLeft !== null && !closed && (
        <p
          className={`px-4 py-1.5 text-center text-[11px] ${
            hoursLeft <= 0 ? "bg-red-50 text-brand-red" : hoursLeft < 3 ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-500"
          }`}
        >
          {hoursLeft <= 0
            ? "เกิน 24 ชม. หลังลูกค้าทักล่าสุดแล้ว — Meta ไม่ให้ตอบ ต้องรอลูกค้าทักมาใหม่"
            : `ตอบได้อีกประมาณ ${hoursLeft < 1 ? "ไม่ถึง 1" : Math.floor(hoursLeft)} ชม. (กฎ 24 ชม. ของ Meta)`}
        </p>
      )}
      {error && <p className="bg-white px-4 pt-2 text-sm text-brand-red">{error}</p>}

      {/* ช่องพิมพ์ / สถานะปิด */}
      {!canReply ? (
        <p className="border-t border-gray-100 bg-white px-4 py-3.5 text-center text-xs text-gray-500">คุณดูแชทได้อย่างเดียว ตอบกลับไม่ได้</p>
      ) : closed ? (
        <div className="border-t border-gray-100 bg-white px-4 pb-4 pt-3 text-center">
          <p className="mb-2.5 text-sm text-gray-500">ทิกเก็ตนี้ปิดแล้ว</p>
          <button
            onClick={() => action("reopen")}
            disabled={busy}
            className="w-full rounded-2xl bg-brand-navy py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            เปิดทิกเก็ตอีกครั้ง
          </button>
        </div>
      ) : (
        <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-gray-100 bg-white px-3 py-2.5">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = ""; // เลือกรูปเดิมซ้ำได้
              if (f) pickImage(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={sending}
            aria-label="แนบรูปหรือไฟล์ PDF"
            title="แนบรูปหรือไฟล์ PDF"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-gray-500 transition active:bg-gray-100 disabled:opacity-40"
          >
            <ImageIcon className="h-6 w-6" />
          </button>
          {conversation?.channel === "line" && (
            <button
              type="button"
              onClick={() => setStickerOpen(true)}
              disabled={sending}
              aria-label="สติกเกอร์"
              title="สติกเกอร์"
              className="-ml-2 flex h-11 w-9 flex-shrink-0 items-center justify-center rounded-full text-2xl leading-none transition active:bg-gray-100 disabled:opacity-40"
            >
              😊
            </button>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter = ส่ง, Shift+Enter = ขึ้นบรรทัดใหม่ (บนคอม)
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSend(e as unknown as FormEvent);
              }
            }}
            rows={1}
            placeholder="พิมพ์ข้อความ..."
            className="max-h-32 min-h-[44px] min-w-0 flex-1 resize-none rounded-3xl bg-gray-100 px-4 py-2.5 text-[15px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            aria-label="ส่ง"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand-navy text-white transition disabled:bg-gray-200 disabled:text-gray-400"
          >
            <SendIcon className="h-5 w-5" />
          </button>
        </form>
      )}

      {deleteOpen && conversation && (
        <DeleteCustomerSheet
          conversation={conversation}
          onDeleted={() => navigate("/chat")}
          onClose={() => setDeleteOpen(false)}
        />
      )}

      {stickerOpen && <StickerPicker sending={sending} onPick={sendSticker} onClose={() => setStickerOpen(false)} />}

      {/* ยืนยันก่อนส่งไฟล์ PDF */}
      {pendingFile && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => !sending && setPendingFile(null)}>
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-center text-sm text-gray-500">ส่งไฟล์ให้ {conversation?.display_name || "ลูกค้า"}</p>
            <div className="mb-3 flex items-center gap-3 rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-200">
              <span className="text-3xl" aria-hidden>📄</span>
              <div className="min-w-0">
                <p className="break-all text-sm font-medium text-gray-900">{pendingFile.name}</p>
                <p className="text-xs text-gray-500">{(pendingFile.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            </div>
            {conversation?.channel === "line" && (
              <p className="mb-3 text-xs text-gray-500">LINE ไม่ให้ OA ส่งไฟล์โดยตรง ลูกค้าจะได้รับเป็นลิงก์สำหรับเปิดไฟล์</p>
            )}
            {error && <p className="mb-3 text-center text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setPendingFile(null)}
                disabled={sending}
                className="flex-1 rounded-2xl bg-gray-100 py-3 text-sm font-semibold text-gray-700 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={sendFile}
                disabled={sending}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-navy py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                <SendIcon className="h-4 w-4" />
                {sending ? "กำลังส่ง..." : "ส่งไฟล์"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ดูรูปก่อนส่ง */}
      {pending && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between p-4 text-white">
            <button onClick={cancelImage} disabled={sending} className="text-sm disabled:opacity-50">
              ยกเลิก
            </button>
            <span className="text-sm text-white/70">ส่งรูปให้ {conversation?.display_name || "ลูกค้า"}</span>
            <span className="w-10" />
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            <img src={pending.previewUrl} alt="รูปที่จะส่ง" className="max-h-full max-w-full rounded-xl object-contain" />
          </div>
          {error && <p className="px-6 pb-2 text-center text-sm text-red-300">{error}</p>}
          <div className="p-4 pb-8">
            <button
              onClick={sendImage}
              disabled={sending}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-semibold text-brand-navy disabled:opacity-60"
            >
              <SendIcon className="h-4 w-4" />
              {sending ? "กำลังส่ง..." : `ส่งรูป (${(pending.blob.size / 1024 / 1024).toFixed(1)} MB)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const MAX_PDF_BYTES = 3 * 1024 * 1024;

function MessageBubble({ m }: { m: ChatMessage }) {
  const time = new Date(m.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  if (m.direction === "system") {
    return (
      <div className="my-3 flex justify-center">
        <span className="rounded-full bg-gray-200/70 px-3 py-1 text-center text-[11px] text-gray-500">{m.text}</span>
      </div>
    );
  }

  const out = m.direction === "out";
  const bare = isBareMedia(m);
  return (
    <div className={`mb-1.5 flex items-end gap-1.5 ${out ? "justify-end" : "justify-start"}`}>
      {out && <span className="mb-0.5 text-[10px] text-gray-400">{time}</span>}
      <div className="max-w-[78%]">
        {bare ? (
          <MessageContent m={m} out={out} />
        ) : (
          <div
            className={`whitespace-pre-wrap break-words px-3.5 py-2 text-[15px] leading-relaxed ${
              out ? "rounded-2xl rounded-br-md bg-brand-navy text-white" : "rounded-2xl rounded-bl-md bg-white text-gray-900 shadow-sm ring-1 ring-gray-100"
            }`}
          >
            <MessageContent m={m} out={out} />
          </div>
        )}
        {out && m.staff_name && <div className="mt-0.5 text-right text-[10px] text-gray-400">{m.staff_name}</div>}
      </div>
      {!out && <span className="mb-0.5 text-[10px] text-gray-400">{time}</span>}
    </div>
  );
}

function DateDivider({ iso }: { iso: string }) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const label =
    d.toDateString() === today.toDateString()
      ? "วันนี้"
      : d.toDateString() === yesterday.toDateString()
        ? "เมื่อวาน"
        : d.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return (
    <div className="my-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-gray-200" />
      <span className="text-[11px] font-medium text-gray-400">{label}</span>
      <span className="h-px flex-1 bg-gray-200" />
    </div>
  );
}

function HeaderButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 items-center justify-center rounded-full text-gray-600 active:bg-gray-100 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function MenuItem({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`block w-full px-4 py-3 text-left text-sm active:bg-gray-50 ${danger ? "text-brand-red" : "text-gray-700"}`}>
      {children}
    </button>
  );
}
