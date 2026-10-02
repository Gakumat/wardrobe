import Link from "next/link";
import { Icon } from "@/components/Icon";
import { PageHeader } from "@/components/PageHeader";
import { HomeControls } from "@/components/home/HomeControls";
import { OutfitCard } from "@/components/outfit/OutfitCard";
import { listOutfits } from "@/lib/outfits/load";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const [{ data: prefs }, { count }, recent] = await Promise.all([
    supabase.from("preferences").select("location_name, lat, lon").maybeSingle(),
    supabase.from("items").select("id", { count: "exact", head: true }).eq("status", "active"),
    listOutfits(supabase, "recent", 4),
  ]);
  const fallback =
    prefs?.lat != null && prefs?.lon != null
      ? { lat: prefs.lat, lon: prefs.lon, name: prefs.location_name ?? "Home" }
      : null;
  const today = new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Australia/Melbourne",
  });
  const canGenerate = (count ?? 0) >= 3;

  return (
    <>
      <PageHeader
        title="Today"
        subtitle={today}
        right={
          <Link href="/settings" aria-label="Settings" className="p-2 text-muted">
            <Icon name="gear" className="h-6 w-6" />
          </Link>
        }
      />
      {!canGenerate && (
        <div className="mx-5 mb-3 card p-4 text-sm">
          <p className="font-medium">Add a few items to get started</p>
          <p className="mt-1 text-muted">You need at least a top, a bottom and shoes accepted in your wardrobe.</p>
          <Link href="/add" className="btn-primary mt-3">
            Add items
          </Link>
        </div>
      )}
      <HomeControls fallback={fallback} canGenerate={canGenerate} />

      {recent.length > 0 && (
        <section className="mt-8 px-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-serif text-2xl">Recent</h2>
            <Link href="/outfits" className="text-sm text-muted">
              All →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {recent.map((o) => (
              <OutfitCard key={o.id} outfit={o} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
