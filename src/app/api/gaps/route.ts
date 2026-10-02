import { NextResponse } from "next/server";
import { z } from "zod";
import { ClaudeError, modelFor, parseJSON } from "@/lib/claude";
import { CATEGORIES, type Item } from "@/lib/schema/item";
import { requireUser, UnauthorizedError } from "@/lib/supabase/server";

export const maxDuration = 120;

const GapsSchema = z.object({
  suggestions: z.array(
    z.object({
      description: z.string().describe('What to look for, descriptive not a brand: "a mid-weight neutral overshirt"'),
      reason: z.string().describe("Why: the gap it fills and what it pairs with, naming owned pieces. 1-2 sentences."),
      unlock_count: z
        .number()
        .int()
        .describe("Honest estimate of how many genuinely new outfits it would enable with what they own"),
    }),
  ),
});

const SYSTEM = `You are a thoughtful stylist auditing someone's wardrobe to find the few additions that would help most. You are not a salesperson: suggest only what fills a real gap, never brands or links.

Look for:
- Missing categories or essentials (e.g. no belt, no proper socks, no bag for work).
- Weather coverage holes for a Melbourne-style climate (no waterproof outer layer, nothing warm enough for winter, nothing breathable for 35°C days).
- Colour gaps (everything is navy and grey; no neutral that bridges their colours) and formality gaps (nothing for a wedding or an interview).
- "Bridge" pieces that would unlock the most new combinations with what they already own.

Return 5-8 suggestions, most valuable first. Make each description specific enough to shop for (colour, weight, cut). Refer to pieces they own by name in the reasons. Use Australian English.`;

function line(i: Item) {
  return [
    i.name,
    `${i.category}${i.subcategory ? `/${i.subcategory}` : ""}`,
    i.colours.map((c) => c.name).join("+"),
    `warmth ${i.warmth} formality ${i.formality}`,
    Object.entries(i.weather_resistance)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(","),
    i.vibes.join(","),
    `worn ${i.times_worn ?? 0}×`,
  ]
    .filter(Boolean)
    .join(" | ");
}

export async function POST() {
  try {
    const { supabase } = await requireUser();
    const { data } = await supabase.from("items_with_wear").select("*").eq("status", "active");
    const items = (data ?? []) as Item[];
    if (items.length < 5) {
      return NextResponse.json({ error: "Add at least 5 items so there's something to analyse." }, { status: 422 });
    }
    const counts = CATEGORIES.map((c) => `${c.label}: ${items.filter((i) => i.category === c.id).length}`).join(", ");
    const result = await parseJSON({
      model: await modelFor(supabase),
      system: SYSTEM,
      schema: GapsSchema,
      effort: "medium",
      maxTokens: 8000,
      content: `## Counts by category\n${counts}\n\n## Every item\n${items.map(line).join("\n")}`,
    });

    await supabase.from("gap_suggestions").delete().eq("dismissed", false);
    if (result.suggestions.length) {
      await supabase.from("gap_suggestions").insert(
        result.suggestions.slice(0, 8).map((s) => ({
          description: s.description,
          reason: s.reason,
          unlock_count: Math.max(0, s.unlock_count),
        })),
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof ClaudeError) return NextResponse.json({ error: e.message }, { status: 422 });
    console.error("gaps failed", e);
    return NextResponse.json({ error: "Gap analysis failed. Please retry." }, { status: 500 });
  }
}
