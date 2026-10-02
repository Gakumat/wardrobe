import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { OutfitCard } from "@/components/outfit/OutfitCard";
import { listOutfits } from "@/lib/outfits/load";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "favourite", label: "Saved", empty: "Tap ♥ Save on an outfit to keep it here." },
  { id: "worn", label: "Worn", empty: "Outfits you mark as worn show up here." },
  { id: "recent", label: "All suggestions", empty: "Generate an outfit from the Today tab." },
] as const;

export default async function OutfitsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: raw } = await searchParams;
  const tab = TABS.find((t) => t.id === raw) ?? TABS[0];
  const supabase = await createClient();
  const outfits = await listOutfits(supabase, tab.id, 40);

  return (
    <>
      <PageHeader title="Outfits" />
      <div className="px-5">
        <div className="mb-5 flex gap-1.5">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={`/outfits?tab=${t.id}`}
              className={`rounded-full border px-3.5 py-1.5 text-sm ${
                t.id === tab.id ? "border-ink bg-ink text-bg" : "border-line bg-surface"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        {outfits.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">{tab.empty}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {outfits.map((o) => (
              <OutfitCard key={o.id} outfit={o} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
