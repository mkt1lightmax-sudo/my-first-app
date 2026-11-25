import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ปักหมุดตำแหน่ง: กด "ใช้ตำแหน่งปัจจุบัน" (GPS มือถือ) หรือแตะ/ลากหมุดบนแผนที่
// แผนที่ใช้ OpenStreetMap (ฟรี ไม่ต้องใช้คีย์) — ปุ่มนำทางยังเปิด Google Maps ตามปกติ

// กรอบประเทศไทย (เผื่อขอบเล็กน้อย) — เลื่อนออกนอกนี้ไม่ได้
const THAILAND_BOUNDS = L.latLngBounds([5.2, 96.8], [20.9, 106.2]);

// หมุดสีแบรนด์ (ไม่ใช้ไฟล์รูปของ Leaflet เพราะหาไม่เจอหลัง build)
const PIN_ICON = L.divIcon({
  className: "",
  html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#e0342e;border:3px solid #fff;transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

export const googleMapsUrl = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

type Props = {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  disabled?: boolean;
};

export default function MapPinPicker({ lat, lng, onChange, disabled }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // สร้างแผนที่ครั้งเดียว
  useEffect(() => {
    if (!boxRef.current || mapRef.current) return;
    const map = L.map(boxRef.current, {
      zoomControl: true,
      attributionControl: true,
      maxBounds: THAILAND_BOUNDS,
      maxBoundsViscosity: 1.0,
      minZoom: 5,
    });
    if (lat != null && lng != null) map.setView([lat, lng], 17);
    else map.fitBounds(THAILAND_BOUNDS); // เปิดมาเห็นประเทศไทยเต็มกรอบ
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (!disabled) onChangeRef.current(e.latlng.lat, e.latlng.lng);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ย้ายหมุดตามค่าที่ได้รับ
  useEffect(() => {
    const map = mapRef.current;
    if (!map || lat == null || lng == null) return;
    if (!markerRef.current) {
      const m = L.marker([lat, lng], { icon: PIN_ICON, draggable: !disabled }).addTo(map);
      m.on("dragend", () => {
        const p = m.getLatLng();
        onChangeRef.current(p.lat, p.lng);
      });
      markerRef.current = m;
      map.setView([lat, lng], Math.max(map.getZoom(), 17));
    } else {
      markerRef.current.setLatLng([lat, lng]);
      if (!map.getBounds().contains([lat, lng])) map.panTo([lat, lng]);
    }
  }, [lat, lng, disabled]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGpsError("เครื่องนี้ไม่รองรับ GPS");
      return;
    }
    setLocating(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onChangeRef.current(pos.coords.latitude, pos.coords.longitude);
        mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 18);
      },
      (err) => {
        setLocating(false);
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? "ไม่ได้อนุญาตให้ใช้ตำแหน่ง — เปิดสิทธิ์ตำแหน่งให้เบราว์เซอร์ หรือแตะบนแผนที่แทน"
            : "หาตำแหน่งไม่ได้ ลองใหม่อีกครั้ง หรือแตะบนแผนที่แทน"
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  return (
    <div className="space-y-2">
      {!disabled && (
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="w-full rounded-lg bg-[#EDF4EF] py-2.5 text-sm font-medium text-[#4C6B57] hover:bg-[#E1EDE5] disabled:opacity-60"
        >
          {locating ? "กำลังหาตำแหน่ง..." : "📍 ใช้ตำแหน่งปัจจุบัน (GPS)"}
        </button>
      )}
      {gpsError && <p className="text-xs text-red-600">{gpsError}</p>}
      <div ref={boxRef} className="relative z-0 h-56 w-full overflow-hidden rounded-lg border" />
      <p className="text-xs text-gray-400">
        {lat != null && lng != null
          ? `ปักไว้ที่ ${lat.toFixed(5)}, ${lng.toFixed(5)}${disabled ? "" : " · ลากหมุดหรือแตะแผนที่เพื่อปรับ"}`
          : "แตะบนแผนที่เพื่อปักหมุด หรือกดใช้ตำแหน่งปัจจุบัน"}
      </p>
    </div>
  );
}
