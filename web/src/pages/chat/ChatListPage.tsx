import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../../lib/api";
import {
  CHANNEL_COLORS,
  CHANNEL_SHORT,
  EMPTY_FILTERS,
  countActiveFilters,
  formatChatTime,
  type ChatAccount,
  type ChatChannel,
  type ChatCounts,
  type ChatFilters,
  type Conversation,
} from "../../lib/chat";
import { BookmarkIcon, FilterIcon, SearchIcon, UserIcon } from "../../components/icons";
import { useAuth } from "../../context/AuthContext";
import { can, isOwner } from "../../lib/permissions";
import FilterSheet from "./FilterSheet";

type View = "mine" | "all" | "closed";

export default function ChatListPage() {
  const { staff } = useAuth();
  const canReply = can(staff, "chat.reply");
  const [view, setView] = useState<View>(canReply ? "all" : "all");
  const [filters, setFilters] = useState<ChatFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [counts, setCounts] = useState<ChatCounts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<ChatAccount[]>([]);

  useEffect(() => {
    api.get<{ ok: true; tags: string[] }>("/chat/tags").then((d) => setTags(d.tags)).catch(() => {});
    api.get<{ ok: true; accounts: ChatAccount[] }>("/chat/accounts").then((d) => setAccounts(d.accounts)).catch(() => {});
  }, []);

  // รอให้พิมพ์เสร็จก่อนค้นหา (ไม่ยิงทุกตัวอักษร)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const p = new URLSearchParams({ view });
    if (filters.read) p.set("read", filters.read);
    if (filters.replied) p.set("replied", filters.replied);
    if (filters.sort === "old") p.set("sort", "old");
    if (filters.tag) p.set("tag", filters.tag);
    if (filters.account) p.set("account", filters.account);
    if (filters.followed) p.set("followed", "1");
    if (filters.unassigned) p.set("filter", "unassigned");
    if (filters.spam) p.set("spam", "1");
    if (debounced) p.set("q", debounced);

    function load() {
      api
        .get<{ ok: true; conversations: Conversation[]; counts: ChatCounts }>(`/chat/conversations?${p}`)
        .then((d) => {
          setConversations(d.conversations);
          setCounts(d.counts);
          setError(null);
        })
        .catch(() => setError("โหลดรายการแชทไม่สำเร็จ"));
    }
    load();
    const interval = setInterval(load, 10000); // เช็กข้อความใหม่ทุก 10 วินาที
    return () => clearInterval(interval);
  }, [view, filters, debounced]);

  if (staff && !can(staff, "chat.view")) return <Navigate to="/" replace />;

  const activeFilters = countActiveFilters(filters);
  const tabs: { value: View; label: string; count?: number }[] = [
    ...(canReply ? [{ value: "mine" as View, label: "ของฉัน", count: counts?.mine }] : []),
    { value: "all", label: "ทั้งหมด", count: counts?.open },
    { value: "closed", label: "ปิดแล้ว" },
  ];

  return (
    <div className="-mx-4 -mt-5">
      {/* หัวหน้า: ชื่อ + ค้นหา + ตัวกรอง */}
      {/* -top-5 ชดเชย padding ของ <main> เพื่อไม่ให้แถบนี้ทับรายการด้านล่าง */}
      <div className="sticky -top-5 z-10 bg-gray-50/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <h1 className="flex-1 text-2xl font-semibold tracking-tight text-gray-900">แชท</h1>
          {can(staff, "reports.view") && (
            <Link
              to="/chat/report"
              className="flex h-10 items-center gap-1.5 rounded-full bg-white px-3.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200"
            >
              <span aria-hidden>📈</span>ยอดขาย
            </Link>
          )}
          <IconButton label="ค้นหา" active={searchOpen || !!search} onClick={() => setSearchOpen((v) => !v)}>
            <SearchIcon className="h-5 w-5" />
          </IconButton>
          <IconButton label="ตัวกรอง" active={activeFilters > 0} onClick={() => setFilterOpen(true)}>
            <FilterIcon className="h-5 w-5" />
            {activeFilters > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-semibold text-white">
                {activeFilters}
              </span>
            )}
          </IconButton>
        </div>

        {searchOpen && (
          <div className="relative mt-3">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อลูกค้า หรือข้อความ"
              className="w-full rounded-2xl border-0 bg-white py-2.5 pl-10 pr-9 text-sm shadow-sm ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-navy/40"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-lg leading-none text-gray-400"
                aria-label="ล้างคำค้น"
              >
                ×
              </button>
            )}
          </div>
        )}

        <div className="mt-3 flex gap-1 rounded-2xl bg-gray-200/70 p-1">
          {tabs.map((t) => (
            <button
              key={t.value}
              onClick={() => setView(t.value)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium transition ${
                view === t.value ? "bg-white text-brand-navy shadow-sm" : "text-gray-500"
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span
                  className={`rounded-full px-1.5 text-[11px] ${view === t.value ? "bg-brand-navy text-white" : "bg-gray-300/80 text-gray-600"}`}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {filters.spam && (
          <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">กำลังดูแชทที่ทำเครื่องหมายว่าสแปม</div>
        )}
      </div>

      {isOwner(staff) && accounts.length === 0 && (
        <Link to="/chat/accounts" className="mx-4 mb-3 block rounded-2xl bg-brand-navy/5 p-4 text-sm text-brand-navy">
          ยังไม่ได้เชื่อมบัญชี LINE / เพจ / IG — แตะที่นี่เพื่อเพิ่ม
        </Link>
      )}
      {error && <p className="px-4 text-sm text-brand-red">{error}</p>}

      {conversations && conversations.length === 0 && (
        <EmptyState view={view} filtered={activeFilters > 0 || !!debounced} />
      )}

      <div className="divide-y divide-gray-100 bg-white">
        {conversations?.map((c) => (
          <ConversationRow key={c.id} c={c} />
        ))}
      </div>

      {filterOpen && (
        <FilterSheet
          value={filters}
          tags={tags}
          accounts={accounts}
          canSeeUnassigned={canReply}
          onApply={(f) => {
            setFilters(f);
            setFilterOpen(false);
          }}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </div>
  );
}

function ConversationRow({ c }: { c: Conversation }) {
  const unread = c.unread_count > 0;
  return (
    <Link to={`/chat/${c.id}`} className="flex gap-3 px-4 py-3.5 transition active:bg-gray-50">
      <Avatar url={c.picture_url} channel={c.channel} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={`truncate text-[15px] ${unread ? "font-semibold text-gray-900" : "font-medium text-gray-800"}`}>
            {c.display_name || "ลูกค้า"}
          </span>
          {c.followed && <BookmarkIcon filled className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />}
          <span className={`ml-auto flex-shrink-0 text-xs ${unread ? "font-medium text-brand-red" : "text-gray-400"}`}>
            {formatChatTime(c.last_message_at)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <p className={`min-w-0 flex-1 truncate text-sm ${unread ? "text-gray-800" : "text-gray-500"}`}>
            {c.last_message_direction === "out" && <span className="text-gray-400">คุณ: </span>}
            {c.last_message_preview}
          </p>
          {unread && (
            <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-red px-1.5 text-[11px] font-semibold text-white">
              {c.unread_count > 99 ? "99+" : c.unread_count}
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Pill tone={c.assigned_staff_name ? "navy" : "gray"}>
            <UserIcon className="h-3 w-3" />
            {c.assigned_staff_name ?? "ยังไม่มีคนดูแล"}
          </Pill>
          {c.last_message_direction === "in" && c.status === "open" && <Pill tone="amber">รอตอบ</Pill>}
          {c.account_name && <Pill tone="gray">{c.account_name}</Pill>}
          {c.tags.slice(0, 2).map((t) => (
            <Pill key={t} tone="blue">
              {t}
            </Pill>
          ))}
          {c.tags.length > 2 && <Pill tone="gray">+{c.tags.length - 2}</Pill>}
        </div>
      </div>
    </Link>
  );
}

function Pill({ tone, children }: { tone: "navy" | "gray" | "blue" | "amber"; children: React.ReactNode }) {
  const tones = {
    navy: "bg-brand-navy/8 text-brand-navy ring-brand-navy/15",
    gray: "bg-gray-50 text-gray-500 ring-gray-200",
    blue: "bg-sky-50 text-sky-700 ring-sky-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
  };
  return (
    <span className={`inline-flex max-w-[11rem] items-center gap-1 truncate rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tones[tone]}`}>
      {children}
    </span>
  );
}

function IconButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`relative flex h-10 w-10 items-center justify-center rounded-full transition ${
        active ? "bg-brand-navy text-white" : "bg-white text-gray-700 shadow-sm ring-1 ring-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ view, filtered }: { view: View; filtered: boolean }) {
  const text = filtered
    ? "ไม่พบแชทที่ตรงกับตัวกรอง"
    : view === "mine"
      ? "ยังไม่มีแชทที่คุณดูแล — เยี่ยมมาก!"
      : view === "closed"
        ? "ยังไม่มีทิกเก็ตที่ปิดแล้ว"
        : "ทุกแชทจัดการเรียบร้อย ✨";
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm ring-1 ring-gray-100">💬</div>
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}

export function Avatar({ url, channel, size = "h-12 w-12" }: { url: string | null; channel?: ChatChannel; size?: string }) {
  return (
    <div className={`relative ${size} flex-shrink-0`}>
      {url ? (
        <img src={url} alt="" className="h-full w-full rounded-full object-cover ring-1 ring-gray-100" />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-200 text-gray-400">
          <UserIcon className="h-1/2 w-1/2" />
        </div>
      )}
      {channel && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-bold ring-2 ring-white ${CHANNEL_COLORS[channel]}`}
        >
          {CHANNEL_SHORT[channel]}
        </span>
      )}
    </div>
  );
}
