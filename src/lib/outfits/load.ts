import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, Item } from "@/lib/schema/item";
import type { Explanation, OutfitView, Source } from "@/lib/schema/outfit";
import { signPaths } from "@/lib/storage";
import type { DaySummary } from "@/lib/weather";

type Row = {
  id: string;
  created_at: string;
  source: Source;
  context: string | null;
  status: OutfitView["status"];
  favourite: boolean;
  explanation: Explanation | null;
  reply: string | null;
  weather: DaySummary | null;
  parent_id: string | null;
  outfit_items: {
    item_id: string;
    slot: Category;
    visible: boolean;
    styling_note: string | null;
    position: number;
    items: Pick<Item, "name" | "subcategory" | "colours" | "photo_cutout" | "photo_original"> | null;
  }[];
};

const SELECT =
  "id, created_at, source, context, status, favourite, explanation, reply, weather, parent_id, outfit_items(item_id, slot, visible, styling_note, position, items(name, subcategory, colours, photo_cutout, photo_original))";

async function toViews(supabase: SupabaseClient, rows: Row[]): Promise<OutfitView[]> {
  const urls = await signPaths(
    supabase,
    rows.flatMap((r) => r.outfit_items.map((oi) => oi.items?.photo_cutout ?? oi.items?.photo_original)),
  );
  return rows.map((r) => {
    const neglect = new Map((r.explanation?.neglect_callouts ?? []).map((n) => [n.item_id, n.note]));
    return {
      id: r.id,
      createdAt: r.created_at,
      source: r.source,
      context: r.context,
      status: r.status,
      favourite: r.favourite,
      explanation: r.explanation,
      reply: r.reply,
      parentId: r.parent_id,
      weather: r.weather
        ? {
            condition: r.weather.condition,
            min: r.weather.range.min,
            max: r.weather.range.max,
            rainChance: r.weather.rainChance,
          }
        : null,
      pieces: [...r.outfit_items]
        .filter((oi) => oi.items) // item deleted since
        .sort((a, b) => a.position - b.position)
        .map((oi) => {
          const path = oi.items!.photo_cutout ?? oi.items!.photo_original;
          return {
            itemId: oi.item_id,
            slot: oi.slot,
            visible: oi.visible,
            stylingNote: oi.styling_note,
            name: oi.items!.name ?? "Item",
            subcategory: oi.items!.subcategory,
            colours: oi.items!.colours ?? [],
            imageUrl: path ? (urls.get(path) ?? null) : null,
            isCutout: !!oi.items!.photo_cutout,
            isHero: r.explanation?.hero_item_id === oi.item_id,
            neglectNote: neglect.get(oi.item_id) ?? null,
          };
        }),
    };
  });
}

export async function loadOutfit(supabase: SupabaseClient, id: string) {
  const { data } = await supabase.from("outfits").select(SELECT).eq("id", id).maybeSingle();
  if (!data) return null;
  return (await toViews(supabase, [data as unknown as Row]))[0];
}

export async function listOutfits(
  supabase: SupabaseClient,
  filter: "favourite" | "worn" | "recent",
  limit = 30,
) {
  let q = supabase.from("outfits").select(SELECT).order("created_at", { ascending: false }).limit(limit);
  if (filter === "favourite") q = q.eq("favourite", true);
  else if (filter === "worn") q = q.eq("status", "worn");
  else q = q.neq("status", "skipped");
  const { data } = await q;
  return toViews(supabase, (data ?? []) as unknown as Row[]);
}
