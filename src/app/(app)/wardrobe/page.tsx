import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { WardrobeGrid } from "@/components/items/WardrobeGrid";
import type { Item } from "@/lib/schema/item";
import { withUrls } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function WardrobePage() {
  const supabase = await createClient();
  const [{ data }, { count: toReview }] = await Promise.all([
    supabase.from("items_with_wear").select("*").eq("status", "active"),
    supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .in("status", ["review", "failed"]),
  ]);
  const items = await withUrls(supabase, (data ?? []) as Item[]);

  return (
    <>
      <PageHeader title="Wardrobe" subtitle={`${items.length} item${items.length === 1 ? "" : "s"}`} />
      <section className="px-5">
        {!!toReview && (
          <Link href="/add" className="card mb-4 flex justify-between px-4 py-3 text-sm">
            <span>{toReview} item{toReview === 1 ? "" : "s"} waiting for review</span>
            <span className="text-accent">Review →</span>
          </Link>
        )}
        {items.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-muted">Your wardrobe is empty.</p>
            <Link href="/add" className="btn-primary mt-4">
              Add your first items
            </Link>
          </div>
        ) : (
          <WardrobeGrid items={items} />
        )}
      </section>
    </>
  );
}
