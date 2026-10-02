"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";

export async function dismissGap(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("gap_suggestions").update({ dismissed: true }).eq("id", id);
  revalidatePath("/gaps");
}
