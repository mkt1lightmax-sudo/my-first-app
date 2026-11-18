// สติกเกอร์ที่ LINE อนุญาตให้ LINE OA ส่งได้ (ตามรายการ "List of available stickers" ของ LINE Messaging API)
// แต่ละชุด: packageId + ช่วงรหัสสติกเกอร์ (ต่อเนื่องกัน) — สติกเกอร์อื่นนอกจากนี้ LINE จะไม่ยอมให้ OA ส่ง
const PACKAGES = [
  { packageId: 11537, first: 52002734, last: 52002773, name: "Brown & Cony 1" },
  { packageId: 11538, first: 51626494, last: 51626533, name: "Brown & Cony 2" },
  { packageId: 11539, first: 52114110, last: 52114149, name: "Universtar BT21" },
  { packageId: 446, first: 1988, last: 2027, name: "Moon & James" },
  { packageId: 789, first: 10855, last: 10894, name: "Sally" },
  { packageId: 1070, first: 17839, last: 17878, name: "Moon Special" },
  { packageId: 6136, first: 10551376, last: 10551399, name: "LINE Characters 1" },
  { packageId: 6325, first: 10979904, last: 10979927, name: "Brown & Cony Fun" },
  { packageId: 6359, first: 11069848, last: 11069871, name: "Brown & Cony 3" },
  { packageId: 6362, first: 11087920, last: 11087943, name: "LINE Characters 2" },
  { packageId: 6370, first: 11088016, last: 11088039, name: "LINE Characters 3" },
  { packageId: 6632, first: 11825374, last: 11825397, name: "LINE Characters 4" },
  { packageId: 8515, first: 16581242, last: 16581265, name: "LINE Characters 5" },
  { packageId: 8522, first: 16581266, last: 16581289, name: "LINE Characters 6" },
  { packageId: 8525, first: 16581290, last: 16581313, name: "LINE Characters 7" },
];

function isAllowed(packageId, stickerId) {
  const p = PACKAGES.find((x) => x.packageId === Number(packageId));
  const s = Number(stickerId);
  return Boolean(p && Number.isInteger(s) && s >= p.first && s <= p.last);
}

module.exports = { PACKAGES, isAllowed };
