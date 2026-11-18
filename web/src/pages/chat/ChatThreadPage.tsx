import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { CHANNEL_COLORS, CHANNEL_LABELS, formatChatTime, metaReplyHoursLeft, type ChatMessage, type Conversation } from "../../lib/chat";
import { Avatar } from "./ChatListPage";
import CustomerPanel from "./CustomerPanel";
import { useAuth } from "../../context/AuthContext";
import { can } from "../../lib/permissions";

type ConversationInfo = Conversation;

export default function ChatThreadPage() {
  const { id } = useParams();
  const { staff: me } = useAuth();
  const [conversation, setConversation] = useState<ConversationInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  useEffect(() => {
    function load() {
      api
        .get<{ ok: true; conversation: ConversationInfo; messages: ChatMessage[] }>(`/chat/conversations/${id}/messages`)
        .then((data) => {
          setConversation(data.conversation);
          setMessages(data.messages);
        })
        .catch(() => setError("โหลดแชทไม่สำเร็จ"));
    }
    load();
    const interval = setInterval(load, 5000); // เช็กข้อความใหม่ทุก 5 วินาที
    return () => clearInterval(interval);
  }, [id]);

  // เลื่อนลงล่างสุดเมื่อมีข้อความใหม่
  useEffect(() => {
    if (messages.length !== lastCount.current) {
      lastCount.current = messages.length;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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

  const hoursLeft = conversation ? metaReplyHoursLeft(conversation) : null;

  return (
    <div className="-mx-4 -my-5 flex h-[calc(100vh-7.5rem)] flex-col">
      <div className="flex items-center gap-3 border-b bg-white px-4 py-2.5">
        <Link to="/chat" className="text-xl text-brand-navy" aria-label="กลับ">
          ‹
        </Link>
        <Avatar url={conversation?.picture_url ?? null} size="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-gray-900">{conversation?.display_name || "ลูกค้า"}</div>
          {conversation && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${CHANNEL_COLORS[conversation.channel]}`}>
              {CHANNEL_LABELS[conversation.channel]}
              {conversation.account_name ? ` · ${conversation.account_name}` : ""}
            </span>
          )}
        </div>
      </div>
      {conversation && <CustomerPanel conversation={conversation} onChange={setConversation} />}

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[80%]">
              <div
                className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                  m.direction === "out" ? "rounded-br-sm bg-brand-navy text-white" : "rounded-bl-sm border bg-white text-gray-900"
                }`}
              >
                {m.text}
              </div>
              <div className={`mt-0.5 text-[10px] text-gray-400 ${m.direction === "out" ? "text-right" : ""}`}>
                {m.direction === "out" && m.staff_name ? `${m.staff_name} · ` : ""}
                {formatChatTime(m.created_at)}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {hoursLeft !== null && (
        <p className={`px-4 py-1.5 text-xs ${hoursLeft <= 0 ? "bg-red-50 text-brand-red" : hoursLeft < 3 ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
          {hoursLeft <= 0
            ? "เกิน 24 ชม. หลังลูกค้าทักล่าสุดแล้ว — Meta ไม่ให้ตอบ ต้องรอลูกค้าทักมาใหม่"
            : `ตอบได้อีกประมาณ ${hoursLeft < 1 ? "ไม่ถึง 1" : Math.floor(hoursLeft)} ชม. (กฎ 24 ชม. ของ Meta)`}
        </p>
      )}
      {error && <p className="bg-white px-4 pt-2 text-sm text-brand-red">{error}</p>}
      {!can(me, "chat.reply") ? (
        <p className="border-t bg-white px-4 py-3 text-center text-xs text-gray-500">คุณดูแชทได้อย่างเดียว ตอบกลับไม่ได้</p>
      ) : (
      <form onSubmit={handleSend} className="flex gap-2 border-t bg-white px-3 py-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="พิมพ์ข้อความ..."
          className="min-w-0 flex-1 rounded-full border px-4 py-2 text-sm focus:border-brand-navy focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="rounded-full bg-brand-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {sending ? "..." : "ส่ง"}
        </button>
      </form>
      )}
    </div>
  );
}
