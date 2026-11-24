import { useEffect, useState } from "react";

// true เมื่อขนาดจอตรงกับเงื่อนไข เช่น "(min-width: 1024px)" — อัปเดตเองเมื่อย่อ/ขยายหน้าต่าง
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

// จอคอม / iPad แนวนอน — แสดงแชทแบบ 2 คอลัมน์
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");
