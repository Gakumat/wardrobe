"use client";

// Browser-side photo pipeline: resize/compress → background removal → trim → upload.

const ORIGINAL_MAX = 1600; // what Claude sees (it downsizes anything larger anyway)
const CUTOUT_MAX = 1024; // what the flat lay shows

export const isMobile = () =>
  typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

async function loadBitmap(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Fallback via <img> for formats createImageBitmap can't handle directly.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return await createImageBitmap(img);
    } catch {
      throw new Error("This photo format couldn't be read. Try a JPEG or PNG (or retake it).");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function canvasFor(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encoding failed"))), type, quality),
  );
}

async function resize(source: ImageBitmap, max: number, type: string, quality?: number) {
  const scale = Math.min(1, max / Math.max(source.width, source.height));
  const w = Math.round(source.width * scale);
  const h = Math.round(source.height * scale);
  const canvas = canvasFor(w, h);
  const ctx = canvas.getContext("2d")!;
  if (type === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(source, 0, 0, w, h);
  return toBlob(canvas, type, quality);
}

/** Crop away fully transparent margins so cut-outs sit tightly in the flat lay. */
/**
 * Clean up the model's alpha mask, then crop away transparent margins.
 *
 * Light garments on light backgrounds (a white tee on a white sheet) often come
 * back partly see-through, which reads as a grey "acid wash" on the flat lay.
 * Anything the background can't reach from the image border is treated as
 * garment and made fully opaque; only the outer edge keeps its soft alpha.
 * Returns null if almost nothing solid survives, so the caller uses the photo.
 */
async function finishCutout(png: Blob): Promise<Blob | null> {
  const bmp = await createImageBitmap(png);
  const canvas = canvasFor(bmp.width, bmp.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  const image = ctx.getImageData(0, 0, bmp.width, bmp.height);
  const { data, width, height } = image;
  const n = width * height;

  // Flood-fill "background" (alpha below threshold) inward from the border.
  const BG = 96;
  const outside = new Uint8Array(n);
  const stack: number[] = [];
  const seed = (i: number) => {
    if (!outside[i] && data[i * 4 + 3] < BG) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < width; x++) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    seed(y * width);
    seed(y * width + width - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % width;
    if (x > 0) seed(i - 1);
    if (x < width - 1) seed(i + 1);
    if (i >= width) seed(i - width);
    if (i < n - width) seed(i + width);
  }

  let solid = 0;
  for (let i = 0; i < n; i++) {
    const a = i * 4 + 3;
    if (!outside[i]) data[a] = 255; // garment interior: fully opaque
    else if (data[a] < 24) data[a] = 0; // drop faint haze around the item
    if (data[a] > 200) solid++;
  }
  if (solid / n < 0.04) return null;
  ctx.putImageData(image, 0, 0);
  return trimTransparent(canvas);
}

async function trimTransparent(canvas: HTMLCanvasElement): Promise<Blob> {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let top = height,
    left = width,
    right = -1,
    bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 12) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) return toBlob(canvas, "image/png"); // nothing opaque; leave as is
  const pad = Math.round(Math.max(width, height) * 0.02);
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  right = Math.min(width - 1, right + pad);
  bottom = Math.min(height - 1, bottom + pad);
  const out = canvasFor(right - left + 1, bottom - top + 1);
  out.getContext("2d")!.drawImage(canvas, left, top, out.width, out.height, 0, 0, out.width, out.height);
  return toBlob(out, "image/png");
}

let bgModule: Promise<typeof import("@imgly/background-removal")> | null = null;

/** Remove the background. Returns null (and the caller falls back to the original) on failure. */
async function cutout(source: ImageBitmap, onProgress?: (p: number) => void): Promise<Blob | null> {
  try {
    bgModule ??= import("@imgly/background-removal");
    const { removeBackground } = await bgModule;
    const input = await resize(source, CUTOUT_MAX, "image/png");
    const result = await removeBackground(input, {
      // fp16 everywhere: the smaller quint8 model badly mangles light garments.
      model: "isnet_fp16",
      output: { format: "image/png" },
      progress: (key, current, total) => {
        if (key.startsWith("fetch") && total > 0) onProgress?.(current / total);
      },
    });
    return await finishCutout(result);
  } catch (e) {
    console.warn("Background removal failed; using the original photo", e);
    return null;
  }
}

export type Processed = { original: Blob; cutout: Blob | null };

export async function processPhoto(
  file: Blob,
  onStage?: (stage: "resizing" | "cutout", progress?: number) => void,
): Promise<Processed> {
  onStage?.("resizing");
  const bmp = await loadBitmap(file);
  const original = await resize(bmp, ORIGINAL_MAX, "image/jpeg", 0.85);
  onStage?.("cutout");
  const cut = await cutout(bmp, (p) => onStage?.("cutout", p));
  bmp.close();
  return { original, cutout: cut };
}

/** Re-run background removal on an already-uploaded original. */
export async function cutoutFromPhoto(original: Blob, onProgress?: (p: number) => void) {
  const bmp = await loadBitmap(original);
  try {
    return await cutout(bmp, onProgress);
  } finally {
    bmp.close();
  }
}

/** Rotate an image 90° clockwise, keeping its format. */
export async function rotate90(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const canvas = canvasFor(bmp.height, bmp.width);
  const ctx = canvas.getContext("2d")!;
  ctx.translate(canvas.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const type = blob.type === "image/png" ? "image/png" : "image/jpeg";
  return toBlob(canvas, type, type === "image/jpeg" ? 0.9 : undefined);
}
