import { Outlet } from "react-router-dom";
import { useIsDesktop } from "../../lib/useMediaQuery";
import { ChatIcon } from "../../components/icons";
import ChatListPage from "./ChatListPage";

// มือถือ / iPad แนวตั้ง: รายชื่อแชท กับ ห้องแชท เป็นคนละหน้า (เหมือนเดิม)
// คอม (กว้าง ≥ 1024px): รายชื่อแชทซ้าย + ห้องแชทขวา ในหน้าเดียว
export default function ChatLayout() {
  const desktop = useIsDesktop();
  if (!desktop) return <Outlet />;

  return (
    <div className="-mx-6 -my-5 flex h-[calc(100dvh-3.5rem)]">
      {/* รายชื่อแชท — กล่องนี้เว้นขอบเหมือนหน้าปกติ เพื่อให้หน้ารายชื่อแชทแสดงผลเหมือนบนมือถือ */}
      <div className="w-[380px] flex-shrink-0 overflow-y-auto border-r border-gray-200 bg-white px-4 pt-5 xl:w-[420px]">
        <ChatListPage />
      </div>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}

// /chat บนคอม: ยังไม่ได้เลือกห้องแชท / บนมือถือ: หน้ารายชื่อแชท
export function ChatIndex() {
  const desktop = useIsDesktop();
  if (!desktop) return <ChatListPage />;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-gray-50 text-gray-400">
      <ChatIcon className="h-12 w-12" />
      <p className="text-sm">เลือกแชททางซ้ายเพื่อเริ่มตอบลูกค้า</p>
    </div>
  );
}
