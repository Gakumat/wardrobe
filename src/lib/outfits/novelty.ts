import type { Category, Item } from "@/lib/schema/item";

const DAY = 86_400_000;

type SlotRef = { itemId: string; slot: Category };

/** Sorted ids of every item: an exact outfit fingerprint. */
export const fullSignature = (pieces: SlotRef[]) =>
  [...new Set(pieces.map((p) => p.itemId))].sort().join("+");

/** The top/bottom/shoe core (one-pieces count as both top and bottom). */
export function trioSignature(pieces: SlotRef[]): string | null {
  const core = pieces.filter((p) => ["top", "bottom", "onepiece", "shoes"].includes(p.slot));
  if (core.length < 2) return null;
  return [...new Set(core.map((p) => p.itemId))].sort().join("+");
}

export function daysSince(iso: string | null | undefined, now = Date.now()) {
  return iso ? Math.floor((now - new Date(iso).getTime()) / DAY) : null;
}

/** 0 (just worn, often) … 1 (never worn). */
export function neglectScore(item: Pick<Item, "times_worn" | "last_worn_at" | "created_at">, now = Date.now()) {
  const worn = item.times_worn ?? 0;
  if (worn === 0) {
    // Brand-new additions aren't "neglected" yet, but still deserve a look.
    const age = daysSince(item.created_at, now) ?? 0;
    return age >= 14 ? 1 : 0.8;
  }
  const days = daysSince(item.last_worn_at, now) ?? 0;
  const recency = Math.min(1, days / 60); // 2 months unworn = fully neglected
  const frequency = 1 / (1 + worn / 3);
  return Math.round((0.7 * recency + 0.3 * frequency) * 100) / 100;
}

/** Human note for neglected items, or null if it's in regular rotation. */
export function neglectLabel(item: Pick<Item, "times_worn" | "last_worn_at" | "created_at">, now = Date.now()) {
  const worn = item.times_worn ?? 0;
  if (worn === 0) {
    const age = daysSince(item.created_at, now) ?? 0;
    return age >= 14 ? "never worn since it was added" : null;
  }
  const days = daysSince(item.last_worn_at, now) ?? 0;
  if (days < 21) return null;
  return days >= 70 ? `not worn in ${Math.round(days / 30)} months` : `not worn in ${Math.round(days / 7)} weeks`;
}

/** Weighted random pick favouring neglected items (for Shuffle's featured piece). */
export function pickNeglected<T extends Pick<Item, "times_worn" | "last_worn_at" | "created_at">>(
  items: T[],
  rand = Math.random,
): T | null {
  if (!items.length) return null;
  const weights = items.map((i) => 0.15 + neglectScore(i) ** 2);
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let k = 0; k < items.length; k++) {
    r -= weights[k];
    if (r <= 0) return items[k];
  }
  return items[items.length - 1];
}
