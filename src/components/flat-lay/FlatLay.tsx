/**
 * Flat-lay presentation of an outfit.
 *
 * Deliberately isolated: it only takes typed pieces and knows nothing about
 * generation, storage or actions, so it can be swapped for a richer editorial
 * layout later without touching anything else.
 */
import type { OutfitPiece } from "@/lib/schema/outfit";

type Zone = "head" | "torso" | "lower" | "feet" | "side";

const UPPER_UNDERWEAR = /bra|bralette|cami|undershirt|singlet|bodysuit|corset|bustier|top|tank/i;

function zoneOf(p: OutfitPiece): Zone {
  switch (p.slot) {
    case "headwear":
      return "head";
    case "top":
    case "midlayer":
    case "outerwear":
    case "onepiece":
      return "torso";
    case "bottom":
      return "lower";
    case "underwear":
      return UPPER_UNDERWEAR.test(`${p.subcategory ?? ""} ${p.name}`) ? "torso" : "lower";
    case "shoes":
    case "socks":
      return "feet";
    default:
      return "side";
  }
}

// Inner → outer, so later layers sit on top and further left.
const LAYER_ORDER: Record<string, number> = { underwear: 0, top: 1, onepiece: 1, midlayer: 2, outerwear: 3 };

const ROW_WEIGHT: Record<Exclude<Zone, "side">, number> = { head: 0.9, torso: 3, lower: 2.6, feet: 1.1 };

export function FlatLay({ pieces, className = "" }: { pieces: OutfitPiece[]; className?: string }) {
  const visible = pieces.filter((p) => p.visible);
  const zones: Record<Zone, OutfitPiece[]> = { head: [], torso: [], lower: [], feet: [], side: [] };
  visible.forEach((p) => zones[zoneOf(p)].push(p));

  // A one-piece with nothing in the lower zone stretches down over it.
  const onepieceSpans = zones.torso.some((p) => p.slot === "onepiece") && zones.lower.length === 0;
  const rows = (["head", "torso", "lower", "feet"] as const).filter(
    (z) => zones[z].length > 0 || (z === "lower" && onepieceSpans),
  );
  const template = rows.map((z) => `${ROW_WEIGHT[z]}fr`).join(" ");
  const hasSide = zones.side.length > 0;

  if (visible.length === 0) return null;

  return (
    <div
      className={`relative aspect-[4/5] w-full overflow-hidden rounded-3xl bg-flatlay p-[5%] ${className}`}
      style={{ backgroundImage: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.35), transparent 60%)" }}
    >
      <div
        className="grid h-full gap-[3%]"
        style={{ gridTemplateColumns: hasSide ? "1fr 0.36fr" : "1fr" }}
      >
        <div className="grid min-h-0 gap-[2.5%]" style={{ gridTemplateRows: template }}>
          {rows.map((z) => {
            if (z === "torso") {
              return (
                <div
                  key={z}
                  className="relative min-h-0"
                  style={onepieceSpans ? { gridRow: "span 2" } : undefined}
                >
                  <Layers pieces={zones.torso} />
                </div>
              );
            }
            if (z === "lower" && onepieceSpans) return null;
            return (
              <div key={z} className="flex min-h-0 items-center justify-center gap-[6%]">
                {zones[z].map((p) => (
                  <Piece key={p.itemId} piece={p} className={zones[z].length > 1 ? "max-w-[46%]" : "max-w-[80%]"} />
                ))}
              </div>
            );
          })}
        </div>

        {hasSide && (
          <div className="flex min-h-0 flex-col items-center justify-center gap-[4%]">
            {zones.side.map((p) => (
              <div key={p.itemId} className="flex min-h-0 w-full flex-1 items-center justify-center" style={{ maxHeight: `${100 / Math.max(3, zones.side.length)}%` }}>
                <Piece piece={p} className="max-w-[92%]" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Torso layers, slightly overlapped: the outer layer sits left and on top. */
function Layers({ pieces }: { pieces: OutfitPiece[] }) {
  const sorted = [...pieces].sort((a, b) => (LAYER_ORDER[a.slot] ?? 1) - (LAYER_ORDER[b.slot] ?? 1));
  const n = sorted.length;
  const offset = n > 1 ? Math.min(22, 48 / (n - 1)) : 0; // % shift between layers
  const width = 100 - offset * (n - 1);
  return (
    <>
      {sorted.map((p, k) => (
        <div
          key={p.itemId}
          className="absolute flex items-center justify-center"
          style={{
            left: `${(n - 1 - k) * offset}%`,
            top: `${k * 3}%`,
            width: `${width}%`,
            height: `${100 - (n - 1) * 3}%`,
            zIndex: k + 1,
          }}
        >
          <Piece piece={p} className="max-w-full" />
        </div>
      ))}
    </>
  );
}

function Piece({ piece, className = "" }: { piece: OutfitPiece; className?: string }) {
  if (!piece.imageUrl) {
    return (
      <div className={`flex h-full w-full items-center justify-center rounded-xl bg-white/50 p-2 text-center text-[10px] text-neutral-600 ${className}`}>
        {piece.name}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={piece.imageUrl}
      alt={piece.name}
      title={piece.name}
      className={`max-h-full min-h-0 ${
        piece.isCutout
          ? "object-contain drop-shadow-[0_6px_10px_rgba(60,45,30,0.22)]"
          : "rounded-xl object-cover shadow-md"
      } ${className}`}
    />
  );
}
