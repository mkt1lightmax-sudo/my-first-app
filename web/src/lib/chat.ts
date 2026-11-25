export type ChatChannel = "line" | "messenger" | "instagram" | "tiktok" | "shopee" | "lazada";

export type Conversation = {
  id: number;
  channel: ChatChannel;
  display_name: string | null;
  picture_url: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  unread_count: number;
  account_id: number | null;
  account_name: string | null;
  last_inbound_at: string | null;
  assigned_staff_id: number | null;
  assigned_staff_name: string | null;
  tags: string[];
  status: "open" | "closed";
  closed_at: string | null;
  closed_by_name: string | null;
  is_spam: boolean;
  followed: boolean;
  last_message_direction: "in" | "out" | null;
  ticket_seq: number;
  deal_amount: number | null;
  deal_outcome: "won" | "lost" | null;
  deal_note: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  customer_note: string | null;
  customer_line_id: string | null;
  customer_info_updated_at: string | null;
  customer_info_updated_by_name: string | null;
};

export function ticketNumber(c: Pick<Conversation, "id" | "ticket_seq">) {
  return `#${c.id}-${c.ticket_seq}`;
}

export function formatBaht(n: number | null | undefined) {
  if (n === null || n === undefined) return "-";
  return "฿" + n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

export type ChatCounts = { mine: number; open: number; unread: number };

// ตัวกรองรายการแชท (ตรงกับ query string ของ GET /chat/conversations)
export type ChatFilters = {
  read: "" | "unread" | "read";
  replied: "" | "no" | "yes";
  sort: "new" | "old";
  tag: string;
  account: string;
  followed: boolean;
  unassigned: boolean;
  spam: boolean;
  assignees: number[]; // กรองตามผู้ดูแล (เซล)
};

// จำนวนแชทที่เปิดอยู่ของแต่ละผู้ดูแล
export type AssigneeCount = { id: number; name: string; count: number };

export const EMPTY_FILTERS: ChatFilters = {
  read: "",
  replied: "",
  sort: "new",
  tag: "",
  account: "",
  followed: false,
  unassigned: false,
  spam: false,
  assignees: [],
};

export function countActiveFilters(f: ChatFilters) {
  return [f.read, f.replied, f.sort === "old", f.tag, f.account, f.followed, f.unassigned, f.spam, f.assignees.length > 0].filter(Boolean).length;
}

// ตัวอักษรบนจุดช่องทางที่มุมรูปโปรไฟล์
export const CHANNEL_SHORT: Record<ChatChannel, string> = {
  line: "L",
  messenger: "f",
  instagram: "IG",
  tiktok: "T",
  shopee: "S",
  lazada: "Lz",
};

export type ChatAccount = {
  id: number;
  channel: "line" | "messenger" | "instagram";
  name: string;
  is_active: boolean;
  has_token: boolean;
  webhook_path: string;
};

// Messenger / IG ตอบได้ภายใน 24 ชม. หลังลูกค้าทักมาล่าสุด
export function metaReplyHoursLeft(c: Pick<Conversation, "channel" | "last_inbound_at">): number | null {
  if (c.channel !== "messenger" && c.channel !== "instagram") return null;
  if (!c.last_inbound_at) return 0;
  const left = 24 - (Date.now() - new Date(c.last_inbound_at).getTime()) / 3600000;
  return Math.max(0, left);
}

export type ChatMessage = {
  id: number;
  direction: "in" | "out" | "system";
  message_type: string;
  text: string | null;
  has_external?: boolean; // มี id ข้อความของ LINE / Meta (Facebook ใช้ตอบกลับแบบอ้างอิงได้)
  meta?: {
    quoteToken?: string; // LINE: ใช้ตอบกลับแบบอ้างอิงข้อความนี้
    replyTo?: { id: number; direction: string; type: string; text: string }; // ข้อความนี้ตอบกลับข้อความไหน
    stickerId?: string | number;
    packageId?: string;
    resourceType?: string;
    fileName?: string;
    fileSize?: number;
    latitude?: number;
    longitude?: number;
    address?: string;
    title?: string;
    url?: string | null;
    externalUrl?: string;
    emojis?: { index: number; length: number; productId: string; emojiId: string }[]; // อีโมจิ LINE ในข้อความ
    mediaToken?: string; // รูปที่พนักงานส่งจากแอปเรา
  } | null;
  created_at: string;
  staff_name?: string | null;
};

export const CHANNEL_LABELS: Record<ChatChannel, string> = {
  line: "LINE",
  messenger: "Messenger",
  instagram: "Instagram",
  tiktok: "TikTok",
  shopee: "Shopee",
  lazada: "Lazada",
};

export const CHANNEL_COLORS: Record<ChatChannel, string> = {
  line: "bg-[#06C755] text-white",
  messenger: "bg-[#0084FF] text-white",
  instagram: "bg-[#E1306C] text-white",
  tiktok: "bg-black text-white",
  shopee: "bg-[#EE4D2D] text-white",
  lazada: "bg-[#0F146D] text-white",
};

export function formatChatTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "เมื่อวาน";
  if (now.getTime() - d.getTime() < 6 * 86400000) return d.toLocaleDateString("th-TH", { weekday: "short" });
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}
