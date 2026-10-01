"use client";

import { STORAGE_BUCKET } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import { processPhoto } from "@/lib/images/process";

export type UploadStage = "queued" | "resizing" | "cutout" | "uploading" | "tagging" | "done" | "error";

/**
 * Full pipeline for one photo. Uploads straight from the browser to Storage
 * (avoids serverless body limits), then asks the server to tag it.
 * Pass an existing itemId to retake a photo.
 */
export async function uploadAndTag(
  file: Blob,
  onStage: (stage: UploadStage, progress?: number) => void,
  existingItemId?: string,
): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You've been signed out. Refresh and sign in again.");

  const { original, cutout } = await processPhoto(file, (s, p) => onStage(s, p));

  onStage("uploading");
  const id = existingItemId ?? crypto.randomUUID();
  const base = `${user.id}/${id}`;
  const originalPath = `${base}/original.jpg`;
  const cutoutPath = cutout ? `${base}/cutout.png` : null;

  const bucket = supabase.storage.from(STORAGE_BUCKET);
  const up1 = await bucket.upload(originalPath, original, { contentType: "image/jpeg", upsert: true });
  if (up1.error) throw new Error(`Upload failed: ${up1.error.message}`);
  if (cutout && cutoutPath) {
    const up2 = await bucket.upload(cutoutPath, cutout, { contentType: "image/png", upsert: true });
    if (up2.error) throw new Error(`Upload failed: ${up2.error.message}`);
  } else if (existingItemId) {
    await bucket.remove([`${base}/cutout.png`]);
  }

  const row = { photo_original: originalPath, photo_cutout: cutoutPath, status: "tagging" as const };
  const { error } = existingItemId
    ? await supabase.from("items").update(row).eq("id", id)
    : await supabase.from("items").insert({ id, ...row });
  if (error) throw new Error(`Saving failed: ${error.message}`);

  onStage("tagging");
  await tagItem(id);
  onStage("done");
  return id;
}

export async function tagItem(id: string) {
  const res = await fetch(`/api/items/${id}/tag`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Tagging failed (${res.status})`);
  }
}
