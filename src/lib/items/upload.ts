"use client";

import { STORAGE_BUCKET } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import { cutoutFromPhoto, processPhoto, rotate90 } from "@/lib/images/process";

export type UploadStage = "queued" | "resizing" | "cutout" | "uploading" | "tagging" | "done" | "error";

type PhotoPaths = { photo_original: string | null; photo_cutout: string | null };

async function currentUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You've been signed out. Refresh and sign in again.");
  return { supabase, user };
}

// Every write gets a fresh file name so no cache can ever serve a stale photo.
const versioned = (userId: string, itemId: string, kind: "original" | "cutout") =>
  `${userId}/${itemId}/${kind}-${Date.now().toString(36)}.${kind === "original" ? "jpg" : "png"}`;

async function put(path: string, blob: Blob) {
  const { supabase } = await currentUser();
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, {
    contentType: path.endsWith(".png") ? "image/png" : "image/jpeg",
    upsert: true,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);
}

async function download(path: string) {
  const { supabase } = await currentUser();
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(path);
  if (error || !data) throw new Error("Couldn't load the photo.");
  return data;
}

/** Point the item at new photo paths and delete the files they replace. */
async function swapPhotos(itemId: string, old: PhotoPaths, next: Partial<PhotoPaths>) {
  const { supabase } = await currentUser();
  const { error } = await supabase.from("items").update(next).eq("id", itemId);
  if (error) throw new Error(`Saving failed: ${error.message}`);
  const stale = (Object.keys(next) as (keyof PhotoPaths)[])
    .map((k) => old[k])
    .filter((p): p is string => !!p && !Object.values(next).includes(p));
  if (stale.length) await supabase.storage.from(STORAGE_BUCKET).remove(stale);
}

/**
 * Full pipeline for one photo. Uploads straight from the browser to Storage
 * (avoids serverless body limits), then asks the server to tag it.
 * Pass an existing item to retake its photo.
 */
export async function uploadAndTag(
  file: Blob,
  onStage: (stage: UploadStage, progress?: number) => void,
  existing?: { id: string } & PhotoPaths,
): Promise<string> {
  const { supabase, user } = await currentUser();
  const { original, cutout } = await processPhoto(file, (s, p) => onStage(s, p));

  onStage("uploading");
  const id = existing?.id ?? crypto.randomUUID();
  const originalPath = versioned(user.id, id, "original");
  const cutoutPath = cutout ? versioned(user.id, id, "cutout") : null;
  await put(originalPath, original);
  if (cutout && cutoutPath) await put(cutoutPath, cutout);

  const paths = { photo_original: originalPath, photo_cutout: cutoutPath };
  if (existing) {
    await swapPhotos(id, existing, paths);
    await supabase.from("items").update({ status: "tagging" }).eq("id", id);
  } else {
    const { error } = await supabase.from("items").insert({ id, ...paths, status: "tagging" });
    if (error) throw new Error(`Saving failed: ${error.message}`);
  }

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

/** Rotate both photos 90° clockwise. Tags are unaffected. */
export async function rotateItem(item: { id: string } & PhotoPaths) {
  const { user } = await currentUser();
  const next: Partial<PhotoPaths> = {};
  for (const key of ["photo_original", "photo_cutout"] as const) {
    const path = item[key];
    if (!path) continue;
    const rotated = await rotate90(await download(path));
    const fresh = versioned(user.id, item.id, key === "photo_original" ? "original" : "cutout");
    await put(fresh, rotated);
    next[key] = fresh;
  }
  await swapPhotos(item.id, item, next);
}

/** Run background removal again from the original photo. */
export async function redoCutout(item: { id: string } & PhotoPaths) {
  if (!item.photo_original) throw new Error("No original photo to work from.");
  const { user } = await currentUser();
  const cut = await cutoutFromPhoto(await download(item.photo_original));
  if (!cut) throw new Error("The cut-out didn't work on this photo. Try 'Use photo' instead.");
  const fresh = versioned(user.id, item.id, "cutout");
  await put(fresh, cut);
  await swapPhotos(item.id, item, { photo_cutout: fresh });
}

/** Drop the cut-out and show the original photo instead. */
export async function revertToOriginalPhoto(item: { id: string } & PhotoPaths) {
  await swapPhotos(item.id, item, { photo_cutout: null });
}
