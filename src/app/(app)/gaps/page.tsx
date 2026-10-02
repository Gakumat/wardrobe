import { PageHeader } from "@/components/PageHeader";
import { GapsView, type Gap } from "@/components/gaps/GapsView";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function GapsPage() {
  const supabase = await createClient();
  const [{ data }, { count }] = await Promise.all([
    supabase
      .from("gap_suggestions")
      .select("id, description, reason, unlock_count, created_at")
      .eq("dismissed", false)
      .order("unlock_count", { ascending: false }),
    supabase.from("items").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);
  return (
    <>
      <PageHeader title="Gaps" subtitle="What would make your wardrobe work harder" />
      <GapsView gaps={(data ?? []) as Gap[]} itemCount={count ?? 0} />
    </>
  );
}
