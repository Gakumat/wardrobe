import Link from "next/link";
import { notFound } from "next/navigation";
import { FlatLay } from "@/components/flat-lay/FlatLay";
import { PageHeader } from "@/components/PageHeader";
import { OutfitActions } from "@/components/outfit/OutfitActions";
import { PieceList } from "@/components/outfit/PieceList";
import { loadOutfit } from "@/lib/outfits/load";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SOURCE_LABEL = {
  today: "Today",
  shuffle: "Shuffle",
  vibe: "Vibe",
  chat: "Your day",
  swap: "Swapped",
} as const;

export default async function OutfitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const outfit = await loadOutfit(supabase, id);
  if (!outfit) notFound();

  const ex = outfit.explanation;
  const date = new Date(outfit.createdAt).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
  const subtitle = [
    SOURCE_LABEL[outfit.source],
    outfit.source === "vibe" && outfit.context ? `“${outfit.context}”` : null,
    date,
    outfit.weather ? `${outfit.weather.min}–${outfit.weather.max}° ${outfit.weather.condition.toLowerCase()}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const visible = outfit.pieces.filter((p) => p.visible);
  const hidden = outfit.pieces.filter((p) => !p.visible);

  return (
    <>
      <PageHeader title={ex?.title ?? "Your outfit"} subtitle={subtitle} back="/" />

      <div className="space-y-8 px-5">
        {outfit.reply && (
          <p className="card rounded-tl-md bg-surface-2 px-4 py-3 text-sm leading-relaxed">{outfit.reply}</p>
        )}

        <FlatLay pieces={outfit.pieces} />

        <OutfitActions outfit={outfit} />

        <section>
          <h2 className="mb-3 font-serif text-2xl">The pieces</h2>
          <PieceList outfitId={outfit.id} pieces={visible} swappable={outfit.status !== "worn"} />
        </section>

        {hidden.length > 0 && (
          <section>
            <h2 className="mb-1 font-serif text-2xl">Underneath</h2>
            <p className="mb-3 text-xs text-muted">Worn but not part of the look</p>
            <PieceList outfitId={outfit.id} pieces={hidden} swappable={outfit.status !== "worn"} compact />
          </section>
        )}

        {ex && (
          <section className="space-y-6">
            <Block title="Why it works">
              <p>{ex.why_it_works}</p>
            </Block>
            <Block title="How to wear it">
              <ol className="space-y-2">
                {ex.how_to_wear.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] text-accent-ink">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </Block>
            <Block title="Weather">
              <p>{ex.weather_note}</p>
            </Block>
            <Block title="Alternate take">
              <p>{ex.alternate_take}</p>
            </Block>
          </section>
        )}

        {outfit.parentId && (
          <Link href={`/outfit/${outfit.parentId}`} className="block text-center text-sm text-muted">
            ← See the outfit this came from
          </Link>
        )}
      </div>
    </>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3>
      <div className="text-[15px] leading-relaxed">{children}</div>
    </div>
  );
}
