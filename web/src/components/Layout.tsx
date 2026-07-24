import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import Logo from "./Logo";
import { useAuth } from "../context/AuthContext";
import { HomeIcon, UsersIcon, BriefcaseIcon, CalendarIcon, BellIcon, UserIcon, LogoutIcon } from "./icons";

const tabs = [
  { to: "/", label: "หน้าหลัก", icon: HomeIcon, end: true },
  { to: "/surveys", label: "ลูกค้า", icon: UsersIcon, end: false },
  { to: "/appointments", label: "งาน", icon: BriefcaseIcon, end: false },
  { to: "/calendar", label: "ปฏิทิน", icon: CalendarIcon, end: false },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  sales: "ฝ่ายขาย",
  surveyor: "ผู้สำรวจ",
  installer: "ช่างติดตั้ง",
};

export default function Layout() {
  const { staff, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-gray-50">
      <header className="relative flex items-center justify-between border-b bg-white px-4 py-3">
        <Logo />
        <div className="flex items-center gap-3">
          <button className="text-brand-navy" aria-label="การแจ้งเตือน">
            <BellIcon className="h-6 w-6" />
          </button>
          <button onClick={() => setMenuOpen((v) => !v)} className="text-brand-navy" aria-label="เมนูบัญชี">
            <UserIcon className="h-6 w-6" />
          </button>
        </div>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-4 top-14 z-20 w-56 rounded-xl border bg-white p-3 shadow-lg">
              <div className="font-medium text-gray-900">{staff?.name}</div>
              <div className="text-xs text-gray-500">{staff ? ROLE_LABELS[staff.role] ?? staff.role : ""}</div>
              <div className="mt-1 truncate text-xs text-gray-400">{staff?.email}</div>
              <button
                onClick={() => logout()}
                className="mt-3 flex w-full items-center gap-2 rounded-lg border border-brand-red px-3 py-2 text-sm font-medium text-brand-red hover:bg-brand-red/5"
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
                <tab.icon className={`h-6 w-6 ${isActive ? "" : "opacity-70"}`} />
                <span className={isActive ? "font-medium" : ""}>{tab.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
