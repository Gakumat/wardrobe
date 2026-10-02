"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";

function refresh(id: string) {
  revalidatePath(`/outfit/${id}`);
  revalidatePath("/outfits");
  revalidatePath("/wardrobe", "layout");
  revalidatePath("/");
}

/** Log the outfit as worn today; wear counts derive from wear_log. */
export async function woreIt(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("wear_log").insert({ outfit_id: id });
  if (error) throw new Error(error.message);
  await supabase.from("outfits").update({ status: "worn", skip_reason: null }).eq("id", id);
  refresh(id);
}

export async function undoWore(id: string) {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("wear_log")
    .select("id")
    .eq("outfit_id", id)
    .order("worn_at", { ascending: false })
    .limit(1);
  if (data?.[0]) await supabase.from("wear_log").delete().eq("id", data[0].id);
  const { count } = await supabase
    .from("wear_log")
    .select("id", { count: "exact", head: true })
    .eq("outfit_id", id);
  if (!count) await supabase.from("outfits").update({ status: "suggested" }).eq("id", id);
  refresh(id);
}

export async function setFavourite(id: string, favourite: boolean) {
  const { supabase } = await requireUser();
  await supabase.from("outfits").update({ favourite }).eq("id", id);
  refresh(id);
}

/** "Not for me": the reason becomes a learned preference for future suggestions. */
export async function skipOutfit(id: string, reason: string) {
  const { supabase, user } = await requireUser();
  const clean = reason.trim().slice(0, 300);
  await supabase.from("outfits").update({ status: "skipped", skip_reason: clean || null }).eq("id", id);

  if (clean) {
    const { data: outfit } = await supabase
      .from("outfits")
      .select("explanation, outfit_items(slot, visible, items(name))")
      .eq("id", id)
      .single();
    const names = ((outfit?.outfit_items ?? []) as unknown as { visible: boolean; items: { name: string } | null }[])
      .filter((x) => x.visible)
      .map((x) => x.items?.name)
      .filter(Boolean)
      .join(" + ");
    const { data: prefs } = await supabase.from("preferences").select("learned").maybeSingle();
    const learned = [...((prefs?.learned ?? []) as { at: string; note: string }[]), {
      at: new Date().toISOString(),
      note: `Rejected "${names}": ${clean}`,
    }].slice(-40);
    await supabase.from("preferences").upsert({ user_id: user.id, learned });
  }
  refresh(id);
}
