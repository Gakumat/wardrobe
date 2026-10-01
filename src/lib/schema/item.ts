import { z } from "zod";

// Single source of truth for the item model (spec §4). The DB check constraints
// in supabase/migrations mirror these enums.

export const CATEGORIES = [
  { id: "headwear", label: "Headwear", hint: "caps, beanies, hats" },
  { id: "eyewear", label: "Eyewear", hint: "sunglasses, glasses" },
  { id: "neckwear", label: "Scarves & neckwear", hint: "scarves, ties, bandanas" },
  { id: "outerwear", label: "Outerwear", hint: "coats, jackets, rain shells" },
  { id: "midlayer", label: "Mid-layers", hint: "jumpers, cardigans, hoodies, overshirts, vests" },
  { id: "top", label: "Tops", hint: "t-shirts, shirts, tanks, long sleeves" },
  { id: "bottom", label: "Bottoms", hint: "jeans, trousers, shorts, skirts" },
  { id: "onepiece", label: "One-pieces", hint: "overalls, jumpsuits, dresses" },
  { id: "belt", label: "Belts", hint: "" },
  { id: "underwear", label: "Underwear", hint: "briefs, boxers, bras, undershirts, lingerie" },
  { id: "socks", label: "Socks", hint: "" },
  { id: "shoes", label: "Shoes", hint: "" },
  { id: "gloves", label: "Gloves", hint: "" },
  { id: "bag", label: "Bags", hint: "backpacks, totes, crossbody, wallets" },
  { id: "jewellery", label: "Jewellery", hint: "rings, necklaces, earrings, bracelets" },
  { id: "watch", label: "Watches", hint: "" },
  { id: "tech", label: "Tech", hint: "headphones, earbuds, phone case" },
  { id: "other", label: "Other", hint: "anything else" },
] as const;

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as unknown as [
  (typeof CATEGORIES)[number]["id"],
  ...(typeof CATEGORIES)[number]["id"][],
];
export type Category = (typeof CATEGORIES)[number]["id"];
export const categoryLabel = (id: string | null | undefined) =>
  CATEGORIES.find((c) => c.id === id)?.label ?? "Uncategorised";

export const PATTERNS = ["solid", "stripe", "check", "graphic", "print", "texture", "other"] as const;
export const FABRIC_WEIGHTS = ["sheer", "light", "mid", "heavy"] as const;
export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export const FITS = ["slim", "regular", "relaxed", "oversized", "cropped"] as const;
export const ROLES = ["hero", "supporting"] as const;
export const VISIBILITY = ["visible", "functional"] as const;
export const VIBE_SUGGESTIONS = [
  "minimal",
  "streetwear",
  "smart",
  "smart-casual",
  "outdoorsy",
  "workwear",
  "sporty",
  "going-out",
  "lounge",
  "vintage",
  "preppy",
  "edgy",
  "romantic",
  "intimate",
];

export const WEATHER_FLAGS = ["waterproof", "windproof", "breathable"] as const;
export const LAYERING_FLAGS = ["good_under", "good_over", "standalone_only"] as const;
export const STYLING_FLAGS = [
  "holds_a_tuck",
  "cuffable",
  "can_cinch_or_knot",
  "drapes_well",
  "sleeves_roll",
] as const;

export const flagLabel = (f: string) => f.replace(/_/g, " ");

const flags = <T extends readonly string[]>(keys: T) =>
  z.object(Object.fromEntries(keys.map((k) => [k, z.boolean()])) as { [K in T[number]]: z.ZodBoolean });

export const TAG_FIELDS = [
  "category",
  "subcategory",
  "name",
  "colours",
  "pattern",
  "material",
  "fabric_weight",
  "warmth",
  "weather_resistance",
  "formality",
  "seasons",
  "fit",
  "vibes",
  "role",
  "layering",
  "styling_properties",
  "visibility_default",
] as const;

/** What Claude returns for a photo. Every field is required so the output is complete. */
export const ItemTagsSchema = z.object({
  category: z.enum(CATEGORY_IDS),
  subcategory: z.string().describe('Specific type, e.g. "oxford shirt", "chelsea boot", "bralette"'),
  name: z
    .string()
    .describe('Short, specific, human name, e.g. "Washed black oversized tee" (max ~5 words)'),
  colours: z
    .array(
      z.object({
        name: z.string().describe('Everyday colour name, e.g. "olive", "ecru", "navy"'),
        hex: z.string().describe("Hex like #4a5d23"),
        proportion: z.number().describe("Share of the visible garment, 0-1; all sum to ~1"),
      }),
    )
    .describe("Primary colour first. 1-4 entries."),
  pattern: z.enum(PATTERNS),
  material: z.string().describe("Best guess: cotton, wool, denim, nylon, leather, linen, etc."),
  fabric_weight: z.enum(FABRIC_WEIGHTS),
  warmth: z.number().int().describe("1 (barely there) to 5 (very warm)"),
  weather_resistance: flags(WEATHER_FLAGS),
  formality: z.number().int().describe("1 loungewear, 2 casual, 3 smart-casual, 4 business, 5 formal"),
  seasons: z.array(z.enum(SEASONS)),
  fit: z.enum(FITS),
  vibes: z.array(z.string()).describe("2-4 lowercase style vibes"),
  role: z
    .enum(ROLES)
    .describe("hero = statement piece that anchors an outfit; supporting = background/basic"),
  layering: flags(LAYERING_FLAGS),
  styling_properties: flags(STYLING_FLAGS),
  visibility_default: z
    .enum(VISIBILITY)
    .describe("functional for underwear, undershirts and most socks; visible for everything else"),
  notes: z.string().describe("Anything useful for styling: details, quirks, care. Empty string if none."),
  low_confidence: z
    .array(z.enum(TAG_FIELDS))
    .describe("Fields you had to guess at and the owner should double-check"),
});
export type ItemTags = z.infer<typeof ItemTagsSchema>;

export type ItemStatus = "pending" | "tagging" | "review" | "active" | "failed";

export type Colour = { name: string; hex: string; proportion: number };

/** A row from public.items (or items_with_wear, which adds the wear columns). */
export type Item = {
  id: string;
  status: ItemStatus;
  error: string | null;
  category: Category | null;
  subcategory: string | null;
  name: string | null;
  colours: Colour[];
  pattern: (typeof PATTERNS)[number] | null;
  material: string | null;
  fabric_weight: (typeof FABRIC_WEIGHTS)[number] | null;
  warmth: number | null;
  weather_resistance: Partial<Record<(typeof WEATHER_FLAGS)[number], boolean>>;
  formality: number | null;
  seasons: (typeof SEASONS)[number][];
  fit: (typeof FITS)[number] | null;
  vibes: string[];
  role: (typeof ROLES)[number] | null;
  layering: Partial<Record<(typeof LAYERING_FLAGS)[number], boolean>>;
  styling_properties: Partial<Record<(typeof STYLING_FLAGS)[number], boolean>>;
  visibility_default: (typeof VISIBILITY)[number] | null;
  notes: string | null;
  low_confidence: string[];
  photo_original: string | null;
  photo_cutout: string | null;
  created_at: string;
  updated_at: string;
  times_worn?: number;
  last_worn_at?: string | null;
};

/** Item plus signed image URLs, as handed to client components. */
export type ItemWithUrls = Item & { cutout_url: string | null; original_url: string | null };

/** Fields the owner may edit; anything else in a patch is dropped. */
export const EditableItemSchema = ItemTagsSchema.omit({ low_confidence: true })
  .extend({ notes: z.string().nullable() })
  .partial();
export type ItemPatch = z.infer<typeof EditableItemSchema>;

const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(n)));

/** Normalise model output before saving (clamp scales, tidy colours/vibes). */
export function normaliseTags(t: ItemTags) {
  const total = t.colours.reduce((s, c) => s + (c.proportion > 0 ? c.proportion : 0), 0) || 1;
  return {
    ...t,
    warmth: clamp(t.warmth),
    formality: clamp(t.formality),
    colours: t.colours.slice(0, 4).map((c) => ({
      name: c.name.toLowerCase(),
      hex: /^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex.toLowerCase() : "#888888",
      proportion: Math.round((Math.max(0, c.proportion) / total) * 100) / 100,
    })),
    vibes: [...new Set(t.vibes.map((v) => v.trim().toLowerCase()).filter(Boolean))].slice(0, 5),
    seasons: [...new Set(t.seasons)],
  };
}
