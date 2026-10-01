import { PageHeader } from "@/components/PageHeader";
import { ReviewQueue } from "@/components/items/ReviewQueue";
import { Uploader } from "@/components/items/Uploader";
import type { Item } from "@/lib/schema/item";
import { withUrls } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AddPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select("*")
    .in("status", ["pending", "tagging", "review", "failed"])
    .order("created_at", { ascending: false });
  const items = await withUrls(supabase, (data ?? []) as Item[]);

  return (
    <>
      <PageHeader title="Add items" subtitle="Photograph it once. Claude does the tagging." />
      <Uploader />
      <ReviewQueue items={items} />
    </>
  );
}
