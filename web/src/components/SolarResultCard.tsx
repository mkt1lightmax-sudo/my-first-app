import { formatNumber, type SolarCalcResult } from "../lib/solar";

export default function SolarResultCard({ result }: { result: SolarCalcResult }) {
  return (
    <div className="rounded-lg border bg-blue-50 p-4">
      <h2 className="mb-3 font-medium text-gray-900">ผลการคำนวณ</h2>
      <dl className="grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-gray-500">ขนาดระบบที่แนะนำ</dt>
          <dd className="font-semibold text-gray-900">{formatNumber(result.recommended_kwp)} kWp</dd>
        </div>
        <div>
          <dt className="text-gray-500">จำนวนแผง</dt>
          <dd className="font-semibold text-gray-900">{result.recommended_panel_count} แผง</dd>
        </div>
        <div>
          <dt className="text-gray-500">ประหยัดโดยประมาณ</dt>
          <dd className="font-semibold text-gray-900">{formatNumber(result.estimated_monthly_savings_thb)} บาท/เดือน</dd>
        </div>
        <div>
          <dt className="text-gray-500">ต้นทุนติดตั้งโดยประมาณ</dt>
          <dd className="font-semibold text-gray-900">{formatNumber(result.estimated_install_cost_thb, 0)} บาท</dd>
        </div>
        <div>
          <dt className="text-gray-500">ระยะเวลาคืนทุน</dt>
          <dd className="font-semibold text-gray-900">
            {result.estimated_payback_years === null ? "-" : `${formatNumber(result.estimated_payback_years)} ปี`}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">พลังงานที่ผลิตได้</dt>
          <dd className="font-semibold text-gray-900">{formatNumber(result.estimated_monthly_generation_kwh)} kWh/เดือน</dd>
        </div>
      </dl>
      {result.roof_area_limited && (
        <p className="mt-3 text-sm text-amber-700">
          ⚠ พื้นที่หลังคาไม่พอสำหรับขนาดระบบที่เหมาะสมเต็มที่ ขนาดที่แนะนำถูกจำกัดตามพื้นที่หลังคาที่มี
        </p>
      )}
    </div>
  );
}
