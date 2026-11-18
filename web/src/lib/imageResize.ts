// ย่อรูปในเครื่องก่อนส่ง: ด้านยาวสุดไม่เกิน 2048px, บันทึกเป็น JPEG
// (PNG ที่เล็กอยู่แล้วส่งตามเดิม เพื่อให้ภาพหน้าจอ/ใบเสนอราคาคมชัด)
const MAX_SIDE = 2048;
const MAX_BYTES = 2.8 * 1024 * 1024;

export type PreparedImage = { blob: Blob; contentType: "image/jpeg" | "image/png"; previewUrl: string };

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("เปิดรูปนี้ไม่ได้ — ลองเลือกรูป JPG หรือ PNG"));
    img.src = URL.createObjectURL(file);
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("ย่อรูปไม่สำเร็จ"))), type, quality)
  );
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) throw new Error("กรุณาเลือกไฟล์รูปภาพ");

  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));

  // PNG เล็ก + ไม่ต้องย่อ → ส่งไฟล์เดิม
  if (file.type === "image/png" && scale === 1 && file.size <= MAX_BYTES) {
    return { blob: file, contentType: "image/png", previewUrl: img.src };
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // พื้นขาวแทนส่วนโปร่งใส (JPEG ไม่มีความโปร่งใส)
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let quality = 0.85;
  let blob = await toBlob(canvas, "image/jpeg", quality);
  while (blob.size > MAX_BYTES && quality > 0.4) {
    quality -= 0.15;
    blob = await toBlob(canvas, "image/jpeg", quality);
  }
  if (blob.size > MAX_BYTES) throw new Error("รูปใหญ่เกินไป ลองเลือกรูปอื่น");
  return { blob, contentType: "image/jpeg", previewUrl: URL.createObjectURL(blob) };
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsDataURL(blob);
  });
}
