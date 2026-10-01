import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { ItemDetail } from "@/components/items/ItemDetail";
import type { Item } from "@/lib/schema/item";
import { withUrls } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type OutfitRef = { id: string; created_at: string; status: string; source: string; favourite: boolean };

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("items_with_wear").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const [item] = await withUrls(supabase, [data as Item], { originals: true });

  const { data: links } = await supabase
    .from("outfit_items")
    .select("outfit:outfits(id, created_at, status, source, favourite)")
    .eq("item_id", id);
  const outfits = ((links ?? []) as unknown as { outfit: OutfitRef | null }[])
    .map((l) => l.outfit)
    .filter((o): o is OutfitRef => !!o && (o.status === "worn" || o.favourite))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const { data: wears } = outfits.length
    ? await supabase
        .from("wear_log")
        .select("worn_at, outfit_id")
        .in(
          "outfit_id",
          outfits.map((o) => o.id),
        )
        .order("worn_at", { ascending: false })
    : { data: [] };

  const fmt = (s: string) =>
    new Date(s).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

  return (
    <>
      <PageHeader title={item.name ?? "Item"} subtitle={item.subcategory ?? undefined} back="/wardrobe" />
      <ItemDetail item={item} />

      <section className="mt-8 space-y-3 px-5">
        <h2 className="font-serif text-2xl">History</h2>
        <p className="text-sm text-muted">
          {item.times_worn
            ? `Worn ${item.times_worn} time${item.times_worn === 1 ? "" : "s"}, last on ${fmt(item.last_worn_at!)}.`
            : "Not worn yet. Expect it to be featured soon."}
        </p>
        {(wears ?? []).length > 0 && (
          <ul className="card divide-y divide-line">
            {(wears ?? []).map((w, i) => (
              <li key={i}>
                <Link href={`/outfit/${w.outfit_id}`} className="flex justify-between px-4 py-3 text-sm">
                  <span>{fmt(w.worn_at)}</span>
                  <span className="text-muted">View outfit →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {outfits.filter((o) => o.favourite).length > 0 && (
          <>
            <h3 className="pt-2 text-sm font-medium">In saved outfits</h3>
            <ul className="flex flex-wrap gap-2">
              {outfits
                .filter((o) => o.favourite)
                .map((o) => (
                  <li key={o.id}>
                    <Link href={`/outfit/${o.id}`} className="chip">
                      {fmt(o.created_at)}
                    </Link>
                  </li>
                ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
