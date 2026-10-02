"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useLocation } from "@/lib/location";
import { categoryLabel } from "@/lib/schema/item";
import type { OutfitPiece } from "@/lib/schema/outfit";
import { GeneratingOverlay, useGenerate } from "./useGenerate";

export function PieceList({
  outfitId,
  pieces,
  swappable,
  compact = false,
}: {
  outfitId: string;
  pieces: OutfitPiece[];
  swappable: boolean;
  compact?: boolean;
}) {
  const place = useLocation();
  const { busy, error, generate } = useGenerate();
  const swap = (p: OutfitPiece) =>
    generate(
      { source: "swap", swap: { outfitId, slot: p.slot }, place },
      `New ${categoryLabel(p.slot).toLowerCase()}`,
    );

  return (
    <>
      <GeneratingOverlay label={busy} />
      {error && <p className="mb-2 text-sm text-warn">{error}</p>}
      <ul className="space-y-2">
        {pieces.map((p) => (
          <li key={p.itemId} className="card flex items-center gap-3 p-2.5">
            <Link href={`/wardrobe/${p.itemId}`} className="flex min-w-0 flex-1 items-center gap-3">
              <div
                className={`flex shrink-0 items-center justify-center rounded-xl bg-flatlay p-1 ${compact ? "h-11 w-11" : "h-16 w-16"}`}
              >
                {p.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" className="max-h-full max-w-full object-contain" />
                )}
              </div>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                  <span className="truncate">{p.name}</span>
                  {p.isHero && <span className="chip border-accent px-2 py-0 text-[10px] text-accent">hero</span>}
                </p>
                {p.stylingNote && <p className="mt-0.5 text-xs leading-snug text-muted">{p.stylingNote}</p>}
                {p.neglectNote && <p className="mt-1 text-xs text-warn">↺ {p.neglectNote}</p>}
              </div>
            </Link>
            {swappable && (
              <button
                onClick={() => swap(p)}
                disabled={!!busy}
                className="shrink-0 rounded-full p-2 text-muted"
                aria-label={`Swap ${p.name}`}
                title="Swap this piece"
              >
                <Icon name="shuffle" className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
