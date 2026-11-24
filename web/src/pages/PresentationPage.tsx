import { Link } from "react-router-dom";
import { ChevronLeftIcon } from "../components/icons";

// เครื่องมือทำภาพนำเสนอลูกค้า (ไฟล์ HTML เดิม) — เซิร์ฟเวอร์ส่งให้เฉพาะคนที่ล็อกอินแล้ว
const TOOL_URL = "/api/tools/presentation";

export default function PresentationPage() {
  return (
    <div className="-mx-4 -my-5 flex h-[calc(100dvh-7.5rem)] flex-col md:-mx-6 md:h-[calc(100dvh-3.5rem)]">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 bg-white px-2 py-2">
        <div className="flex items-center gap-1">
          <Link to="/" className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 active:bg-gray-100" aria-label="กลับ">
            <ChevronLeftIcon className="h-6 w-6" />
          </Link>
          <h1 className="font-semibold text-gray-900">คำนวณระบบ & ภาพนำเสนอ</h1>
        </div>
        <a href={TOOL_URL} target="_blank" rel="noreferrer" className="rounded-full px-3 py-1.5 text-sm text-brand-navy hover:bg-brand-navy/5">
          เปิดเต็มจอ ↗
        </a>
      </div>
      <iframe src={TOOL_URL} title="ภาพนำเสนอลูกค้า" className="min-h-0 w-full flex-1 border-0 bg-white" />
    </div>
  );
}
