import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../../lib/api";
import { CHANNEL_COLORS, CHANNEL_LABELS, formatChatTime, type ChatAccount, type Conversation } from "../../lib/chat";
import { UserIcon } from "../../components/icons";
import { useAuth } from "../../context/AuthContext";
import { can, isOwner } from "../../lib/permissions";

type Filter = "all" | "mine" | "unassigned";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "mine", label: "ลูกค้าของฉัน" },
  { value: "unassigned", label: "ยังไม่มีคนดูแล" },
];

export default function ChatListPage() {
  const { staff } = useAuth();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [tag, setTag] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<ChatAccount[]>([]);
  const [accountId, setAccountId] = useState<string>("");

  useEffect(() => {
    api.get<{ ok: true; tags: string[] }>("/chat/tags").then((d) => setTags(d.tags)).catch(() => {});
    api.get<{ ok: true; accounts: ChatAccount[] }>("/chat/accounts").then((d) => setAccounts(d.accounts)).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("filter", filter);
    if (tag) params.set("tag", tag);
    if (accountId) params.set("account", accountId);
    const qs = params.toString();

    function load() {
      api
        .get<{ ok: true; conversations: Conversation[] }>(`/chat/conversations${qs ? `?${qs}` : ""}`)
        .then((data) => {
          setConversations(data.conversations);
          setError(null);
        })
        .catch(() => setError("โหลดรายการแชทไม่สำเร็จ"));
    }
    load();
    const interval = setInterval(load, 10000); // เช็กข้อความใหม่ทุก 10 วินาที
    return () => clearInterval(interval);
  }, [filter, tag, accountId]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-gray-900">แชทลูกค้า</h1>
        {accounts.length > 1 && (
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="min-w-0 max-w-[55%] rounded-lg border bg-white px-2 py-1.5 text-xs"
          >
            <option value="">ทุกบัญชี</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {CHANNEL_LABELS[a.channel]} · {a.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {staff && !can(staff, "chat.view") && <Navigate to="/" replace />}
      {isOwner(staff) && accounts.length === 0 && (
        <Link to="/chat/accounts" className="mb-3 block rounded-lg bg-brand-navy/5 p-3 text-sm text-brand-navy">
          ยังไม่ได้เชื่อมบัญชี LINE / เพจ / IG — แตะที่นี่เพื่อเพิ่ม
        </Link>
      )}

      <div className="mb-2 flex gap-1 rounded-lg bg-gray-200 p-1">
        {FILTERS.filter((f) => f.value !== "mine" || can(staff, "chat.reply")).map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium ${
              filter === f.value ? "bg-white text-brand-navy shadow-sm" : "text-gray-500"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <TagChip label="ทุกกลุ่ม" active={tag === ""} onClick={() => setTag("")} />
        {tags.map((t) => (
          <TagChip key={t} label={t} active={tag === t} onClick={() => setTag(tag === t ? "" : t)} />
        ))}
      </div>

      {error && <p className="text-sm text-brand-red">{error}</p>}
      {conversations && conversations.length === 0 && (
        <p className="text-gray-500">
          {filter === "all" && !tag ? "ยังไม่มีแชท — เมื่อลูกค้าทักมาทาง LINE OA จะขึ้นที่นี่" : "ไม่มีแชทในกลุ่มนี้"}
        </p>
      )}

      <div className="space-y-2">
        {conversations?.map((c) => (
          <Link key={c.id} to={`/chat/${c.id}`} className="flex items-center gap-3 rounded-xl border bg-white p-3 hover:bg-gray-50">
            <Avatar url={c.picture_url} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`truncate ${c.unread_count > 0 ? "font-semibold" : "font-medium"} text-gray-900`}>
                  {c.display_name || "ลูกค้า"}
                </span>
                <span
                  className={`max-w-[45%] flex-shrink-0 truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${CHANNEL_COLORS[c.channel]}`}
                >
                  {c.account_name || CHANNEL_LABELS[c.channel]}
                </span>
              </div>
              <div className={`truncate text-sm ${c.unread_count > 0 ? "text-gray-900" : "text-gray-500"}`}>
                {c.last_message_preview}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className={`text-[11px] ${c.assigned_staff_name ? "text-brand-navy" : "text-gray-400"}`}>
                  {c.assigned_staff_name ? `ดูแลโดย ${c.assigned_staff_name}` : "ยังไม่มีคนดูแล"}
                </span>
                {c.tags.map((t) => (
                  <span key={t} className="rounded-full bg-brand-navy/10 px-2 py-0.5 text-[10px] text-brand-navy">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-shrink-0 flex-col items-end gap-1 self-start">
              <span className="text-xs text-gray-400">{formatChatTime(c.last_message_at)}</span>
              {c.unread_count > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-red px-1.5 text-[10px] font-bold text-white">
                  {c.unread_count > 99 ? "99+" : c.unread_count}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function TagChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs ${
        active ? "border-brand-navy bg-brand-navy text-white" : "border-gray-300 bg-white text-gray-600"
      }`}
    >
      {label}
    </button>
  );
}

export function Avatar({ url, size = "h-11 w-11" }: { url: string | null; size?: string }) {
  if (url) return <img src={url} alt="" className={`${size} flex-shrink-0 rounded-full object-cover`} />;
  return (
    <div className={`${size} flex flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-400`}>
      <UserIcon className="h-1/2 w-1/2" />
    </div>
  );
}
