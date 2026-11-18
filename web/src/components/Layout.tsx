import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import Logo from "./Logo";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { HomeIcon, UsersIcon, BriefcaseIcon, CalendarIcon, BellIcon, ChatIcon, UserIcon, UserPlusIcon, LogoutIcon } from "./icons";
import { staffRoleLabel } from "../lib/staff";
import { formatNotificationTime, type Notification } from "../lib/notifications";
import { can, isOwner } from "../lib/permissions";
import { useChatUnread } from "../lib/useChatUnread";
import NotificationSettings from "./NotificationSettings";

const allTabs = [
  { to: "/", label: "หน้าหลัก", icon: HomeIcon, end: true },
  { to: "/surveys", label: "ลูกค้า", icon: UsersIcon, end: false },
  { to: "/appointments", label: "งาน", icon: BriefcaseIcon, end: false },
  { to: "/chat", label: "แชท", icon: ChatIcon, end: false },
  { to: "/calendar", label: "ปฏิทิน", icon: CalendarIcon, end: false },
];

export default function Layout() {
  const { staff, logout } = useAuth();
  const tabs = allTabs.filter((t) => t.to !== "/chat" || can(staff, "chat.view"));
  const chatUnread = useChatUnread(can(staff, "chat.view"));
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  function loadNotifications() {
    api
      .get<{ ok: true; notifications: Notification[]; unreadCount: number }>("/notifications")
      .then((data) => {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  async function handleNotificationClick(n: Notification) {
    if (!n.is_read) {
      await api.patch(`/notifications/${n.id}/read`);
      loadNotifications();
    }
    setNotifOpen(false);
    if (n.appointment_id) navigate(`/appointments/${n.appointment_id}/edit`);
    else if (n.chat_conversation_id) navigate(`/chat/${n.chat_conversation_id}`);
  }

  async function handleMarkAllRead() {
    await api.patch("/notifications/read-all");
    loadNotifications();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-gray-50">
      <header className="relative flex items-center justify-between border-b bg-white px-4 py-3">
        <Logo />
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setNotifOpen((v) => !v);
              setMenuOpen(false);
            }}
            className="relative text-brand-navy"
            aria-label="การแจ้งเตือน"
          >
            <BellIcon className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-red text-[9px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setMenuOpen((v) => !v);
              setNotifOpen(false);
            }}
            className="text-brand-navy"
            aria-label="เมนูบัญชี"
          >
            <UserIcon className="h-6 w-6" />
          </button>
        </div>

        {notifOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
            <div className="absolute right-4 top-14 z-20 max-h-96 w-72 overflow-y-auto rounded-xl border bg-white p-2 shadow-lg">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-sm font-medium text-gray-900">การแจ้งเตือน</span>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="text-xs text-brand-navy hover:underline">
                    อ่านทั้งหมด
                  </button>
                )}
              </div>
              {notifications.length === 0 && <p className="px-2 py-3 text-sm text-gray-400">ยังไม่มีการแจ้งเตือน</p>}
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-gray-50 ${
                    n.is_read ? "text-gray-500" : "text-gray-900"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-red" />}
                    <div className={n.is_read ? "ml-3.5" : ""}>
                      <div>{n.message}</div>
                      <div className="mt-0.5 text-xs text-gray-400">{formatNotificationTime(n.created_at)}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-4 top-14 z-20 w-56 rounded-xl border bg-white p-3 shadow-lg">
              <div className="font-medium text-gray-900">{staff?.name}</div>
              <div className="text-xs text-gray-500">{staff ? staffRoleLabel(staff) : ""}</div>
              <div className="mt-1 truncate text-xs text-gray-400">{staff?.email}</div>

              {can(staff, "staff.manage") && (
                <Link
                  to="/staff"
                  onClick={() => setMenuOpen(false)}
                  className="mt-3 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <UserPlusIcon className="h-4 w-4" />
                  จัดการพนักงาน
                </Link>
              )}
              {isOwner(staff) && (
                <Link
                  to="/chat/accounts"
                  onClick={() => setMenuOpen(false)}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <ChatIcon className="h-4 w-4" />
                  บัญชีแชท (LINE / เพจ / IG)
                </Link>
              )}

              {can(staff, "chat.view") && <NotificationSettings />}

              <button
                onClick={() => logout()}
                className="mt-2 flex w-full items-center gap-2 rounded-lg border border-brand-red px-3 py-2 text-sm font-medium text-brand-red hover:bg-brand-red/5"
              >
                <LogoutIcon className="h-4 w-4" />
                ออกจากระบบ
              </button>
            </div>
          </>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-5 pb-20">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md border-t bg-white">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-xs ${
                isActive ? "text-brand-navy" : "text-gray-400"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <tab.icon className={`h-6 w-6 ${isActive ? "" : "opacity-70"}`} />
                  {tab.to === "/chat" && chatUnread > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-bold text-white ring-2 ring-white">
                      {chatUnread > 99 ? "99+" : chatUnread}
                    </span>
                  )}
                </span>
                <span className={isActive ? "font-medium" : ""}>{tab.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
