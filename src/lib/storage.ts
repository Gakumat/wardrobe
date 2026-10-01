import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { SIGNED_URL_TTL, STORAGE_BUCKET } from "./config";
import type { Item, ItemWithUrls } from "./schema/item";

/** Batch-sign storage paths. Returns path → URL. */
export async function signPaths(supabase: SupabaseClient, paths: (string | null | undefined)[]) {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrls(unique, SIGNED_URL_TTL);
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);
  }
  return map;
}

export async function withUrls(
  supabase: SupabaseClient,
  items: Item[],
  { originals = false }: { originals?: boolean } = {},
): Promise<ItemWithUrls[]> {
  const urls = await signPaths(
    supabase,
    items.flatMap((i) => [i.photo_cutout ?? i.photo_original, originals ? i.photo_original : null]),
  );
  return items.map((i) => ({
    ...i,
    cutout_url: urls.get(i.photo_cutout ?? i.photo_original ?? "") ?? null,
    original_url: originals ? (urls.get(i.photo_original ?? "") ?? null) : null,
  }));
}
