"use client";

/**
 * Resize + re-encode a photo in the browser before it is sent for reading.
 * Drawing to a canvas also drops EXIF (location, device) from the file.
 */
export async function compressImage(
  file: File,
  maxSide = 1600,
  quality = 0.82,
): Promise<{ base64: string; mediaType: "image/jpeg"; thumb: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file could not be opened as a picture."));
      el.src = url;
    });
    const draw = (side: number, q: number) => {
      const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not prepare the picture.");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      return canvas.toDataURL("image/jpeg", q);
    };
    const full = draw(maxSide, quality);
    const thumb = draw(160, 0.6);
    return { base64: full.split(",")[1] ?? "", mediaType: "image/jpeg", thumb };
  } finally {
    URL.revokeObjectURL(url);
  }
}
