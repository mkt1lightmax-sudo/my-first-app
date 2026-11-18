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
  direction: "in" | "out";
  message_type: string;
  text: string | null;
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
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}
