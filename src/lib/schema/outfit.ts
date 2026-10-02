import { z } from "zod";
import { CATEGORY_IDS, type Category, type Colour } from "./item";

export const SOURCES = ["today", "shuffle", "vibe", "chat", "swap"] as const;
export type Source = (typeof SOURCES)[number];

/** Slot = category. These may hold more than one item (e.g. tee under an open shirt). */
export const MULTI_SLOTS: Partial<Record<Category, number>> = {
  top: 2,
  midlayer: 2,
  underwear: 3,
  jewellery: 4,
  other: 2,
};
export const slotCap = (c: Category) => MULTI_SLOTS[c] ?? 1;

/** What Claude returns when composing an outfit. Items are referenced by short aliases (i1, i2…). */
export const ProposedOutfitSchema = z.object({
  title: z.string().describe("Evocative 3-7 word name for the look"),
  context_kind: z
    .enum(["out", "home", "intimate"])
    .describe("out = leaving the house; home = lounging at home; intimate = intimate/at-home context"),
  items: z.array(
    z.object({
      ref: z.string().describe("Item alias from the wardrobe list, e.g. i12"),
      slot: z.enum(CATEGORY_IDS).describe("The item's category"),
      visible: z
        .boolean()
        .describe("true if it's part of the visible look (shown in the flat lay); false if functional/hidden"),
      styling_note: z
        .string()
        .describe("Specific instruction for this piece: tuck, roll, cuff, knot, how to layer it. Short."),
    }),
  ),
  hero_ref: z.string().describe("Alias of the single hero piece"),
  explanation: z.object({
    why_it_works: z.string().describe("Colour, proportion, texture and the hero piece. 3-5 sentences."),
    how_to_wear: z
      .array(z.string())
      .describe("3-6 concrete technique steps (e.g. 'French-tuck the tee, front only, left of the button')"),
    weather_note: z.string().describe("Why it suits today's weather and what to add/shed as the day changes"),
    alternate_take: z.string().describe("One tweak that turns it into a different look"),
  }),
  neglect_callouts: z
    .array(z.object({ ref: z.string(), note: z.string() }))
    .describe("For deliberately featured neglected pieces, e.g. 'Not worn in 6 weeks: time it came out'"),
  reply: z.string().describe("Short conversational reply to the user (chat only; empty string otherwise)"),
});
export type ProposedOutfit = z.infer<typeof ProposedOutfitSchema>;

export type Explanation = {
  title: string;
  why_it_works: string;
  how_to_wear: string[];
  weather_note: string;
  alternate_take: string;
  hero_item_id: string | null;
  neglect_callouts: { item_id: string; note: string }[];
  context_kind: ProposedOutfit["context_kind"];
};

/** One piece of an outfit, ready to render. */
export type OutfitPiece = {
  itemId: string;
  slot: Category;
  visible: boolean;
  stylingNote: string | null;
  name: string;
  subcategory: string | null;
  colours: Colour[];
  imageUrl: string | null;
  isCutout: boolean;
  isHero: boolean;
  neglectNote: string | null;
};

/** Everything the outfit screen (and the flat lay) needs. */
export type OutfitView = {
  id: string;
  createdAt: string;
  source: Source;
  context: string | null;
  status: "suggested" | "worn" | "skipped";
  favourite: boolean;
  explanation: Explanation | null;
  reply: string | null;
  weather: { condition: string; min: number; max: number; rainChance: number } | null;
  pieces: OutfitPiece[];
  parentId: string | null;
};
