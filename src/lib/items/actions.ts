"use server";

import { revalidatePath } from "next/cache";
import { STORAGE_BUCKET } from "@/lib/config";
import { EditableItemSchema, type ItemPatch } from "@/lib/schema/item";
import { requireUser } from "@/lib/supabase/server";

function refresh() {
  revalidatePath("/add");
  revalidatePath("/wardrobe", "layout");
}

export async function acceptItem(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("items").update({ status: "active" }).eq("id", id).eq("status", "review");
  refresh();
}

export async function acceptAll() {
  const { supabase } = await requireUser();
  await supabase.from("items").update({ status: "active" }).eq("status", "review");
  refresh();
}

/** Save edits. Editing a field clears its low-confidence flag. */
export async function updateItem(id: string, patch: ItemPatch) {
  const { supabase } = await requireUser();
  const clean = EditableItemSchema.parse(patch);
  const { data: current } = await supabase
    .from("items")
    .select("low_confidence")
    .eq("id", id)
    .single();
  const edited = new Set(Object.keys(clean));
  const low_confidence = (current?.low_confidence ?? []).filter((f: string) => !edited.has(f));
  const { error } = await supabase
    .from("items")
    .update({ ...clean, low_confidence })
    .eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function deleteItem(id: string) {
  const { supabase } = await requireUser();
  const { data: item } = await supabase
    .from("items")
    .select("photo_original, photo_cutout")
    .eq("id", id)
    .single();
  await supabase.from("items").delete().eq("id", id);
  const paths = [item?.photo_original, item?.photo_cutout].filter((p): p is string => !!p);
  if (paths.length) await supabase.storage.from(STORAGE_BUCKET).remove(paths);
  refresh();
}
