import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ClaudeError, modelFor, parseJSON } from "@/lib/claude";
import { categoryLabel, flagLabel, type Category, type Item } from "@/lib/schema/item";
import {
  ProposedOutfitSchema,
  slotCap,
  type Explanation,
  type ProposedOutfit,
  type Source,
} from "@/lib/schema/outfit";
import { fetchDay, weatherBrief, type DaySummary } from "@/lib/weather";
import { filterPool } from "./filter";
import { daysSince, fullSignature, neglectLabel, pickNeglected, trioSignature } from "./novelty";
import { validateProposal, type ValidPiece } from "./validate";

export type ComposeRequest = {
  source: Source;
  vibe?: string;
  place?: { lat: number; lon: number; name?: string } | null;
  /** Swap one slot of an existing outfit. */
  swap?: { outfitId: string; slot: Category };
  /** Describe-my-day chat: prior turns plus the outfit being refined, if any. */
  chat?: { messages: { role: "user" | "assistant"; content: string }[]; baseOutfitId?: string | null };
};

export class ComposeError extends Error {}

const SYSTEM = `You are a sharp, inventive personal stylist with deep menswear and womenswear knowledge. You dress one person using only the clothes they own (listed below), for a private wardrobe app.

What matters, in order:
1. Novelty: build combinations they haven't worn. Never repeat an outfit listed as already worn and avoid repeating a worn top + bottom + shoes trio. Favour pieces flagged NEGLECTED, and when you deliberately feature one, add a neglect_callout for it.
2. Head-to-toe: every outfit is complete. Include underwear and socks whenever the person owns them (choose sensibly: no-show socks with loafers or low sneakers, warm socks in the cold, a bra or undershirt that suits the neckline and fabric). Add accessories (bag, watch, jewellery, eyewear, headwear, scarf, belt, gloves, tech) when they add something or the day needs them, e.g. sunglasses when UV is high, a beanie when it's cold, a bag big enough for a laptop when work is mentioned.
3. Function: suit the real weather across the whole day, not just now. Use warmth (1-5), fabric weight and weather flags. Layer only where the weather or the look calls for it, respecting the layering flags (good_under / good_over / standalone_only). Plan for the coldest and warmest parts of the day and say what to add or shed.
4. Style: roughly one hero piece; the rest support it. Make colour choices deliberate (complementary, analogous, tonal, or a clash you can justify). Balance proportion and silhouette (e.g. oversized top with a slimmer bottom, or volume-on-volume with a reason). Mix textures.
5. Teaching: give specific techniques that make basics look intentional, using each item's styling flags: French tuck, half tuck, full tuck, knotting a hem, cinching with a belt, rolling sleeves (how many times), cuffing jeans (size of cuff), wearing a shirt open over a tee, collar in/out, layering a longer hem under a shorter one, pushing sleeves up, etc.

Visibility: underwear, undershirts and plain socks are normally functional (visible: false) and listed under the look. Promote any item to visible when it is part of the look: socks as a colour pop or with cropped trousers; in intimate or at-home contexts underwear or lingerie may be the visible layer or the whole outfit. Treat intimate items in the same matter-of-fact, practical way as everything else.

Rules:
- Use only the aliases listed (i1, i2…). Each item at most once. Slots are the item's category.
- Slot limits: at most ${slotCap("top")} tops (e.g. a tee under an open shirt), ${slotCap("midlayer")} mid-layers, ${slotCap("underwear")} underwear pieces, ${slotCap("jewellery")} jewellery pieces; one of every other category.
- context_kind is "out" unless the request is clearly about staying home or an intimate context. An "out" outfit must have a top (or one-piece), a bottom (or one-piece), shoes and underwear when owned.
- Commit to your choices. If a piece is wrong for the conditions (suede in heavy rain, say), pick a different one instead of hedging.
- Write like a knowledgeable friend: specific, warm and practical, with no filler. Refer to pieces by their names, and never mention aliases (i1, i12…) in any text you write. Use Australian English.`;

function describe(alias: string, i: Item, now: number) {
  const parts = [
    alias,
    i.name ?? "Unnamed",
    `${i.category}${i.subcategory ? `/${i.subcategory}` : ""}`,
    i.colours.map((c) => `${c.name}${i.colours.length > 1 ? ` ${Math.round(c.proportion * 100)}%` : ""}`).join(" + ") || "colour ?",
    [i.pattern, i.material, i.fabric_weight && `${i.fabric_weight}-weight`].filter(Boolean).join(" "),
    `warmth ${i.warmth ?? "?"} · formality ${i.formality ?? "?"}`,
    i.fit && `fit ${i.fit}`,
    i.role === "hero" && "HERO piece",
    i.vibes.length && `vibes: ${i.vibes.join(", ")}`,
    i.seasons.length && i.seasons.length < 4 && `seasons: ${i.seasons.join(", ")}`,
    flags("layering", i.layering),
    flags("styling", i.styling_properties),
    flags("weather", i.weather_resistance),
    i.visibility_default === "functional" && "functional by default",
    wornText(i, now),
    i.notes && `notes: ${i.notes}`,
  ];
  return parts.filter(Boolean).join(" | ");
}

function flags(label: string, f: Record<string, boolean | undefined>) {
  const on = Object.entries(f)
    .filter(([, v]) => v)
    .map(([k]) => flagLabel(k));
  return on.length ? `${label}: ${on.join(", ")}` : null;
}

function wornText(i: Item, now: number) {
  const n = i.times_worn ?? 0;
  const label = neglectLabel(i, now);
  const base = n === 0 ? "never worn" : `worn ${n}×, last ${daysSince(i.last_worn_at, now)} days ago`;
  return label ? `${base} · NEGLECTED` : base;
}

type HistoryRow = {
  id: string;
  status: string;
  created_at: string;
  outfit_items: { item_id: string; slot: Category; items: { name: string | null } | null }[];
};

function outfitLine(o: HistoryRow) {
  const names = o.outfit_items
    .filter((x) => !["underwear", "socks"].includes(x.slot))
    .map((x) => x.items?.name ?? "?");
  return `- ${o.created_at.slice(0, 10)}: ${names.join(" + ")}`;
}

/** Compose (or swap, or refine) an outfit with Claude and save it. Returns the new outfit id. */
export async function composeOutfit(supabase: SupabaseClient, req: ComposeRequest) {
  const now = Date.now();

  const historyQuery = () =>
    supabase.from("outfits").select("id, status, created_at, outfit_items(item_id, slot, items(name))");
  const [itemsRes, prefsRes, wornRes, recentRes, weather] = await Promise.all([
    supabase.from("items_with_wear").select("*").eq("status", "active"),
    supabase.from("preferences").select("likes, dislikes, learned").maybeSingle(),
    historyQuery().eq("status", "worn").order("created_at", { ascending: false }).limit(100),
    historyQuery().eq("status", "suggested").order("created_at", { ascending: false }).limit(12),
    req.place
      ? fetchDay(req.place.lat, req.place.lon).catch(() => null)
      : Promise.resolve<DaySummary | null>(null),
  ]);

  const items = (itemsRes.data ?? []) as Item[];
  if (items.length < 3) {
    throw new ComposeError("Add and accept a few more items first (at least a top, a bottom and shoes).");
  }
  const owned = new Set(items.map((i) => i.category!));
  const worn = (wornRes.data ?? []) as unknown as HistoryRow[];
  const recent = (recentRes.data ?? []) as unknown as HistoryRow[];
  const refsOf = (o: HistoryRow) => o.outfit_items.map((x) => ({ itemId: x.item_id, slot: x.slot }));
  const wornFull = new Set(worn.map((o) => fullSignature(refsOf(o))));
  const wornTrios = new Set(worn.map((o) => trioSignature(refsOf(o))).filter((t): t is string => !!t));

  // ---- candidate pool -------------------------------------------------------
  const filtered = filterPool(items, weather);
  let pool = filtered.pool;
  const notes = filtered.notes;
  let mustInclude: string[] = [];
  let mustExclude: string[] = [];
  let parentId: string | null = null;
  let base: { pieces: { item_id: string; slot: Category; visible: boolean; styling_note: string | null }[]; context: string | null } | null = null;

  const baseOutfitId = req.swap?.outfitId ?? req.chat?.baseOutfitId ?? null;
  if (baseOutfitId) {
    const { data } = await supabase
      .from("outfits")
      .select("id, context, outfit_items(item_id, slot, visible, styling_note)")
      .eq("id", baseOutfitId)
      .single();
    if (data) {
      base = { pieces: data.outfit_items as NonNullable<typeof base>["pieces"], context: data.context };
      parentId = data.id;
    }
  }

  if (req.swap) {
    if (!base) throw new ComposeError("Couldn't find that outfit.");
    const slot = req.swap.slot;
    const kept = base.pieces.filter((p) => p.slot !== slot);
    const replaced = base.pieces.filter((p) => p.slot === slot).map((p) => p.item_id);
    const alternatives = pool.filter((i) => i.category === slot && !replaced.includes(i.id));
    const fallbackAlternatives = items.filter((i) => i.category === slot && !replaced.includes(i.id));
    const choices = alternatives.length ? alternatives : fallbackAlternatives;
    if (!choices.length) throw new ComposeError(`There's no other ${categoryLabel(slot).toLowerCase()} to swap in.`);
    const keptItems = items.filter((i) => kept.some((k) => k.item_id === i.id));
    pool = [...keptItems, ...choices];
    mustInclude = keptItems.map((i) => i.id);
    mustExclude = replaced;
  }

  // Shuffle features one neglected visible piece to force variety.
  let featured: Item | null = null;
  if (req.source === "shuffle") {
    featured = pickNeglected(
      pool.filter((i) => !["underwear", "socks"].includes(i.category!) && i.visibility_default !== "functional"),
    );
    if (featured) mustInclude = [featured.id];
  }

  const aliases = new Map<string, Item>();
  pool.forEach((item, idx) => aliases.set(`i${idx + 1}`, item));
  const aliasOf = (id: string) => [...aliases.entries()].find(([, i]) => i.id === id)?.[0] ?? "?";

  // ---- prompt ---------------------------------------------------------------
  const prefs = prefsRes.data;
  const learned = ((prefs?.learned ?? []) as { note: string }[]).slice(-15).map((l) => `- ${l.note}`);
  const request = (() => {
    switch (req.source) {
      case "today":
        return "Dress me for today. Make it right for the weather and something I haven't worn before.";
      case "shuffle":
        return `Shuffle: surprise me with an unexpected but coherent outfit.${featured ? ` Build it around ${aliasOf(featured.id)} (${featured.name}); it must be included.` : ""}`;
      case "vibe":
        return `Vibe: "${req.vibe}". Interpret this vibe creatively with what I own, and explain how the outfit captures it.`;
      case "swap": {
        const keep = mustInclude.map((id) => `${aliasOf(id)} (${aliases.get(aliasOf(id))?.name})`).join(", ");
        return `Swap: keep these items exactly: ${keep}. Replace only the ${categoryLabel(req.swap!.slot).toLowerCase()} with a different option from the list. Return the full outfit (kept items + new piece), keeping visibility sensible, and rewrite the styling notes and explanation for the new combination.${base?.context ? ` Original context: "${base.context}".` : ""}`;
      }
      case "chat":
        return "Describe-my-day: read the conversation below and dress me for the whole day it describes: transitions between activities, comfort, practicality (bags, layers for evening, cycling etc.). Put a short, friendly conversational reply in `reply` (2-4 sentences: what you went for and why, plus one practical tip).";
    }
  })();

  const sections = [
    `## Request\n${request}`,
    `## Weather\n${weather ? weatherBrief(weather, req.place?.name) : "Unavailable: dress for mild, changeable conditions and say so."}`,
    `## Preferences\nLikes: ${prefs?.likes || "(none given)"}\nDislikes: ${prefs?.dislikes || "(none given)"}${learned.length ? `\nLearned from outfits they rejected:\n${learned.join("\n")}` : ""}`,
    worn.length
      ? `## Already worn (never repeat exactly; avoid the same top + bottom + shoes)\n${worn.slice(0, 30).map(outfitLine).join("\n")}`
      : "## Already worn\nNothing logged yet.",
    recent.length && req.source !== "swap"
      ? `## Recently suggested (aim for something different)\n${recent.map(outfitLine).join("\n")}`
      : "",
    base && req.source === "chat"
      ? `## Current outfit being refined\n${base.pieces.map((p) => `- ${aliasOf(p.item_id)} (${p.slot}${p.visible ? "" : ", hidden"}): ${p.styling_note ?? ""}`).join("\n")}`
      : "",
    notes.length ? `## Notes\n${notes.map((n) => `- ${n}`).join("\n")}` : "",
    `## Wardrobe (alias | name | category | colours | material | warmth · formality | …)\n${[...aliases.entries()].map(([a, i]) => describe(a, i, now)).join("\n")}`,
  ].filter(Boolean);

  const chatTurns = req.chat?.messages ?? [];
  const conversation = chatTurns.length
    ? `\n\n## Conversation\n${chatTurns.map((m) => `${m.role === "user" ? "Me" : "You"}: ${m.content}`).join("\n")}`
    : "";
  const prompt = sections.join("\n\n") + conversation;

  // ---- call + validate (one corrective retry) --------------------------------
  const model = await modelFor(supabase);
  const ask = (history: Anthropic.MessageParam[], content: string) =>
    parseJSON({
      model,
      system: SYSTEM,
      schema: ProposedOutfitSchema,
      effort: "medium",
      maxTokens: 12000,
      history,
      content,
    });

  let proposal: ProposedOutfit = await ask([], prompt);
  let check = validateProposal(proposal, aliases, { owned, wornFull, wornTrios, enforceTrio: true, mustInclude, mustExclude });
  if (check.errors.length) {
    proposal = await ask(
      [
        { role: "user", content: prompt },
        { role: "assistant", content: JSON.stringify(proposal) },
      ],
      `That outfit has problems:\n${check.errors.map((e) => `- ${e}`).join("\n")}\nFix them and return the complete corrected outfit.`,
    );
    check = validateProposal(proposal, aliases, { owned, wornFull, wornTrios, enforceTrio: false, mustInclude, mustExclude });
    if (check.errors.length) {
      throw new ComposeError(`Couldn't build a valid outfit (${check.errors[0]}) Please try again.`);
    }
  }

  return saveOutfit(supabase, {
    req,
    proposal,
    pieces: check.pieces,
    heroId: check.heroId,
    aliases,
    weather,
    parentId,
    context: req.source === "vibe" ? req.vibe ?? null : req.source === "chat" ? chatTurns.filter((m) => m.role === "user").map((m) => m.content).join(" / ") : base?.context ?? null,
  });
}

async function saveOutfit(
  supabase: SupabaseClient,
  args: {
    req: ComposeRequest;
    proposal: ProposedOutfit;
    pieces: ValidPiece[];
    heroId: string | null;
    aliases: Map<string, Item>;
    weather: DaySummary | null;
    parentId: string | null;
    context: string | null;
  },
) {
  const { proposal, pieces, aliases } = args;
  const refs = pieces.map((p) => ({ itemId: p.item.id, slot: p.slot }));
  const explanation: Explanation = {
    title: proposal.title,
    why_it_works: proposal.explanation.why_it_works,
    how_to_wear: proposal.explanation.how_to_wear,
    weather_note: proposal.explanation.weather_note,
    alternate_take: proposal.explanation.alternate_take,
    hero_item_id: args.heroId,
    context_kind: proposal.context_kind,
    neglect_callouts: proposal.neglect_callouts
      .map((n) => ({ item_id: aliases.get(n.ref.trim())?.id ?? "", note: n.note }))
      .filter((n) => n.item_id && pieces.some((p) => p.item.id === n.item_id)),
  };

  const { data: outfit, error } = await supabase
    .from("outfits")
    .insert({
      source: args.req.source,
      context: args.context,
      weather: args.weather,
      explanation,
      reply: args.req.source === "chat" ? proposal.reply || null : null,
      signature: fullSignature(refs),
      trio_signature: trioSignature(refs),
      parent_id: args.parentId,
    })
    .select("id")
    .single();
  if (error || !outfit) throw new ComposeError(`Saving the outfit failed: ${error?.message}`);

  const { error: itemsError } = await supabase.from("outfit_items").insert(
    pieces.map((p, position) => ({
      outfit_id: outfit.id,
      item_id: p.item.id,
      slot: p.slot,
      visible: p.visible,
      styling_note: p.styling_note || null,
      position,
    })),
  );
  if (itemsError) throw new ComposeError(`Saving the outfit failed: ${itemsError.message}`);

  return { id: outfit.id as string, reply: args.req.source === "chat" ? proposal.reply || null : null };
}

export { ClaudeError };
