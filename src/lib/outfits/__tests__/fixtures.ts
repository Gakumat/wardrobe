import type { Category, Item } from "@/lib/schema/item";

let n = 0;
export function item(category: Category, over: Partial<Item> = {}): Item {
  n++;
  return {
    id: `id-${category}-${n}`,
    status: "active",
    error: null,
    category,
    subcategory: null,
    name: `${category} ${n}`,
    colours: [{ name: "black", hex: "#000000", proportion: 1 }],
    pattern: "solid",
    material: "cotton",
    fabric_weight: "mid",
    warmth: 2,
    weather_resistance: {},
    formality: 2,
    seasons: [],
    fit: "regular",
    vibes: [],
    role: "supporting",
    layering: {},
    styling_properties: {},
    visibility_default: "visible",
    notes: null,
    low_confidence: [],
    photo_original: null,
    photo_cutout: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    times_worn: 0,
    last_worn_at: null,
    ...over,
  };
}
