import type { Category, Item } from "@/lib/schema/item";
import type { DaySummary } from "@/lib/weather";

/** Categories an outfit can't do without; a filter must never empty these. */
const PROTECTED: Category[] = ["top", "bottom", "onepiece", "shoes", "underwear", "socks"];

export type PoolResult = { pool: Item[]; notes: string[] };

/**
 * Cheap rule-based narrowing before Claude sees anything (spec §6.2.1).
 * Only removes clear mismatches; taste and vibe are left to the model.
 */
export function filterPool(items: Item[], weather: DaySummary | null): PoolResult {
  const active = items.filter((i) => i.status === "active" && i.category);
  const notes: string[] = [];
  if (!weather) return { pool: active, notes };

  const { feelsMin, feelsMax } = weather.range;
  const hot = feelsMax >= 27;
  const warm = feelsMax >= 22;
  const cold = feelsMax <= 13;
  const wet = weather.rainChance >= 50;

  const keep = (i: Item): boolean => {
    const w = i.warmth ?? 3;
    // Heavy pieces on a hot day (wet days keep waterproof outer layers).
    if (hot && w >= 4 && !(i.category === "outerwear" && wet && i.weather_resistance.waterproof)) return false;
    if (hot && i.category === "outerwear" && w >= 3 && !(wet && i.weather_resistance.waterproof)) return false;
    if (warm && !hot && w >= 5) return false;
    // Barely-there bottoms, gloves etc. on a cold day are filtered; warm accessories kept.
    if (cold && i.category === "bottom" && w <= 1) return false;
    if (!cold && feelsMin > 14 && i.category === "gloves") return false;
    return true;
  };

  let pool = active.filter(keep);

  // Never leave a protected category empty: put its items back and say so.
  for (const cat of PROTECTED) {
    const owned = active.filter((i) => i.category === cat);
    if (owned.length && !pool.some((i) => i.category === cat)) {
      pool = pool.concat(owned);
      notes.push(
        `No ${cat} item is ideal for today's temperatures; all ${cat} options are included. Pick the most suitable and compensate with layers.`,
      );
    }
  }
  if (wet && !pool.some((i) => i.weather_resistance.waterproof)) {
    notes.push("Rain is likely but the wardrobe has no waterproof pieces; favour darker, quick-drying fabrics and mention it.");
  }
  return { pool, notes };
}
