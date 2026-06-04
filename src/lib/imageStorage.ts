import { supabase } from "@/integrations/supabase/client";

const BUCKET = "product-images";

export function isDataUrl(url: string): boolean {
  return url.startsWith("data:");
}

export function isHttpImageUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** Compress file to WebP/JPEG blob (max 800px) for fast landing LCP. */
export function compressImageToBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 800;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) {
            height = Math.round((height * MAX) / width);
            width = MAX;
          } else {
            width = Math.round((width * MAX) / height);
            height = MAX;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas"));
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("blob"))),
          "image/webp",
          0.62
        );
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Upload to Supabase Storage; returns public CDN URL. */
export async function uploadProductImage(
  file: File,
  ownerId: string,
  storeId?: string | null
): Promise<string> {
  const blob = await compressImageToBlob(file);
  const ext = blob.type.includes("webp") ? "webp" : "jpg";
  const path = `${ownerId}/${storeId || "default"}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Upload a data URL or remote image URL to Supabase Storage. */
export async function uploadImageFromUrl(
  url: string,
  ownerId: string,
  storeId?: string | null
): Promise<string> {
  if (!url) return url;
  if (isHttpImageUrl(url) && !isDataUrl(url)) return url;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`فشل تحميل الصورة (${res.status})`);
  const blob = await res.blob();
  const ext = blob.type.includes("webp") ? "webp" : blob.type.includes("png") ? "png" : "jpg";
  const path = `${ownerId}/${storeId || "default"}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
