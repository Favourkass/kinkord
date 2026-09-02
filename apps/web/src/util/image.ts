export interface CompressOptions {
  /** Longest edge, in px, after downscaling. */
  maxDim?: number;
  /** JPEG quality, 0–1. */
  quality?: number;
  /** Files at or below this size and within maxDim are returned untouched. */
  maxBytes?: number;
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

/**
 * Downscale + re-encode a photo so uploads survive slow mobile networks.
 * A phone photo (several MB) becomes a few hundred KB. Always safe: if the
 * environment can't process the image, or the result isn't smaller, the
 * original file is returned unchanged.
 */
export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const { maxDim = 1600, quality = 0.82, maxBytes = 800 * 1024 } = opts;

  // SSR / non-images / animated GIFs (canvas would flatten them) pass through.
  if (typeof document === "undefined") return file;
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  try {
    const bitmap = await loadBitmap(file);
    const srcW = bitmap.width;
    const srcH = bitmap.height;
    const scale = Math.min(1, maxDim / Math.max(srcW, srcH));

    // Already small enough and no downscale needed — keep the original bytes.
    if (scale === 1 && file.size <= maxBytes) return file;

    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
    if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    // Never let compression block an upload.
    return file;
  }
}
