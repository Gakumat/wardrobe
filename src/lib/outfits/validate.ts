import type { Category, Item } from "@/lib/schema/item";
import { slotCap, type ProposedOutfit } from "@/lib/schema/outfit";
import { fullSignature, trioSignature } from "./novelty";

export type ValidPiece = { item: Item; slot: Category; visible: boolean; styling_note: string };

export type ValidateOptions = {
  /** Categories the user owns at least one active item in. */
  owned: Set<string>;
  wornFull: Set<string>;
  wornTrios: Set<string>;
  /** Reject repeated top+bottom+shoe trios (relaxed on the retry). */
  enforceTrio: boolean;
  /** Item ids that must appear (swap: the kept pieces; shuffle: the featured piece). */
  mustInclude?: string[];
  /** Item ids that must not appear (swap: the piece being replaced). */
  mustExclude?: string[];
};

export type ValidateResult = {
  errors: string[];
  pieces: ValidPiece[];
  heroId: string | null;
};

export function validateProposal(
  p: ProposedOutfit,
  aliases: Map<string, Item>,
  opts: ValidateOptions,
): ValidateResult {
  const errors: string[] = [];
  const pieces: ValidPiece[] = [];
  const seen = new Set<string>();

  for (const entry of p.items) {
    const item = aliases.get(entry.ref.trim());
    if (!item) {
      errors.push(`"${entry.ref}" is not in the wardrobe list. Only use listed aliases.`);
      continue;
    }
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    // Trust the item's real category over whatever slot the model wrote.
    pieces.push({ item, slot: item.category!, visible: entry.visible, styling_note: entry.styling_note });
  }

  const count = (c: Category) => pieces.filter((x) => x.slot === c).length;
  const has = (c: Category) => count(c) > 0;
  for (const c of new Set(pieces.map((x) => x.slot))) {
    if (count(c) > slotCap(c)) errors.push(`Too many ${c} items (max ${slotCap(c)}).`);
  }

  const kind = p.context_kind;
  if (kind === "out") {
    const ownsTop = opts.owned.has("top") || opts.owned.has("onepiece");
    const ownsBottom = opts.owned.has("bottom") || opts.owned.has("onepiece");
    if (ownsTop && !has("top") && !has("onepiece")) errors.push("Missing a top (or one-piece).");
    if (ownsBottom && !has("bottom") && !has("onepiece")) errors.push("Missing a bottom (or one-piece).");
    if (opts.owned.has("shoes") && !has("shoes")) errors.push("Missing shoes.");
    if (opts.owned.has("underwear") && !has("underwear")) errors.push("Missing underwear (it can be hidden).");
  } else if (pieces.length === 0) {
    errors.push("The outfit is empty.");
  }
  if (pieces.length > 0 && !pieces.some((x) => x.visible)) {
    errors.push("Nothing is visible; mark the pieces that make up the look as visible.");
  }

  for (const id of opts.mustInclude ?? []) {
    if (!seen.has(id)) {
      const name = [...aliases.entries()].find(([, i]) => i.id === id);
      errors.push(`You must include ${name ? `${name[0]} (${name[1].name})` : "the required item"}.`);
    }
  }
  for (const id of opts.mustExclude ?? []) {
    if (seen.has(id)) errors.push("You reused the piece that was meant to be swapped out.");
  }

  const refs = pieces.map((x) => ({ itemId: x.item.id, slot: x.slot }));
  if (pieces.length && opts.wornFull.has(fullSignature(refs))) {
    errors.push("This exact outfit has already been worn. Change at least one piece.");
  }
  const trio = trioSignature(refs);
  if (opts.enforceTrio && trio && opts.wornTrios.has(trio)) {
    errors.push("This top + bottom + shoes combination has been worn before. Change at least one of them.");
  }

  const hero = aliases.get(p.hero_ref.trim());
  const heroId =
    hero && seen.has(hero.id)
      ? hero.id
      : (pieces.find((x) => x.visible && x.item.role === "hero") ?? pieces.find((x) => x.visible))?.item.id ?? null;

  return { errors, pieces, heroId };
}
