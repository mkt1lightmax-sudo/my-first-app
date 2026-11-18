export type Notification = {
  id: number;
  type: string;
  message: string;
  appointment_id: number | null;
  chat_conversation_id: number | null;
  is_read: boolean;
  created_at: string;
};

export function formatNotificationTime(iso: string) {
  return new Date(iso).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}
