"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MODEL_ALLOWLIST } from "@/lib/config";
import { requireUser } from "@/lib/supabase/server";

const Prefs = z.object({
  likes: z.string().max(2000).optional(),
  dislikes: z.string().max(2000).optional(),
  location_name: z.string().max(120).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lon: z.number().min(-180).max(180).nullable().optional(),
  model: z.enum(MODEL_ALLOWLIST.map((m) => m.id) as [string, ...string[]]).nullable().optional(),
});

export async function savePreferences(patch: z.infer<typeof Prefs>) {
  const { supabase, user } = await requireUser();
  const clean = Prefs.parse(patch);
  const { error } = await supabase.from("preferences").upsert({ user_id: user.id, ...clean });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function forgetLearned(index: number | "all") {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("preferences").select("learned").maybeSingle();
  const learned = (data?.learned ?? []) as unknown[];
  const next = index === "all" ? [] : learned.filter((_, i) => i !== index);
  await supabase.from("preferences").upsert({ user_id: user.id, learned: next });
  revalidatePath("/settings");
}

/** Lets the home-screen app sign in with email + password (magic links open in Safari, not the app). */
export async function setPassword(password: string) {
  if (password.length < 8) throw new Error("Use at least 8 characters.");
  const { supabase } = await requireUser();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}
