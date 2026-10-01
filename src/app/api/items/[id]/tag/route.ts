import { NextResponse } from "next/server";
import { ClaudeError, modelFor, parseJSON } from "@/lib/claude";
import { STORAGE_BUCKET } from "@/lib/config";
import { CATEGORIES, ItemTagsSchema, normaliseTags } from "@/lib/schema/item";
import { requireUser, UnauthorizedError } from "@/lib/supabase/server";

export const maxDuration = 60;

const SYSTEM = `You are an expert stylist and garment technologist cataloguing one item from a person's own wardrobe for a private styling app.

You will see a single photo of one item (laid flat, on a hanger, or worn). Describe that item only, ignoring the background, hanger, hands, or other objects.

Always give your best guess for every field. Never refuse or leave a field blank because you are unsure; instead, add that field's name to low_confidence so the owner can double-check it. Typical low-confidence fields from a photo: material, fabric_weight, warmth, weather_resistance, fit.

Categories (pick exactly one):
${CATEGORIES.map((c) => `- ${c.id}: ${c.label}${c.hint ? ` (${c.hint})` : ""}`).join("\n")}
Overshirts, shackets, cardigans, hoodies and vests are "midlayer". Dresses go under "onepiece". Undershirts are "underwear".

Guidance:
- name: short and specific, the way a person would refer to it ("Cream cable-knit crew", "Faded straight-leg jeans").
- colours: realistic hex values sampled from the garment, not idealised; primary first; proportions sum to ~1.
- warmth: 1 = tank/sheer, 2 = tee/light shirt, 3 = sweatshirt/light jacket, 4 = wool jumper/insulated jacket, 5 = heavy winter coat. Accessories that don't add warmth are 1 (beanies, scarves and gloves do add warmth).
- formality: 1 loungewear/underwear, 2 casual, 3 smart-casual, 4 business, 5 formal/black tie.
- seasons: every season it's comfortably wearable in (Melbourne climate).
- role: "hero" if it's a statement that would anchor an outfit (strong colour, bold pattern, distinctive cut/texture); otherwise "supporting".
- layering: good_under (sits well under other layers), good_over (works as an open/over layer), standalone_only (doesn't layer).
- styling_properties: holds_a_tuck (hem tucks neatly), cuffable (hems/sleeves can cuff), can_cinch_or_knot (hem knots or waist cinches with a belt), drapes_well (fluid fabric), sleeves_roll (sleeves roll up and stay).
- visibility_default: "functional" for underwear, undershirts and plain everyday socks; "visible" for everything else (statement socks and lingerie designed to be seen can be "visible").
- vibes: 2-4 lowercase descriptors such as minimal, streetwear, smart, smart-casual, outdoorsy, workwear, sporty, going-out, lounge, vintage, preppy, edgy, romantic, intimate.
- notes: concise details useful for styling (e.g. "boxy cropped length, sits at the hip", "contrast stitching", "slightly sheer"). Empty string if nothing notable.

Underwear, lingerie and intimate items are a normal part of a wardrobe: catalogue them in the same neutral, practical way.`;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let supabase;
  try {
    ({ supabase } = await requireUser());
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const { data: item, error } = await supabase
    .from("items")
    .select("id, photo_original, photo_cutout")
    .eq("id", id)
    .single();
  if (error || !item?.photo_original) {
    return NextResponse.json({ error: "Item or photo not found" }, { status: 404 });
  }

  await supabase.from("items").update({ status: "tagging", error: null }).eq("id", id);

  try {
    const { data: blob, error: dlError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(item.photo_original);
    if (dlError || !blob) throw new ClaudeError("Couldn't read the photo from storage.");
    const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");

    const tags = await parseJSON({
      model: await modelFor(supabase),
      system: SYSTEM,
      schema: ItemTagsSchema,
      effort: "low",
      maxTokens: 4000,
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
        { type: "text", text: "Catalogue this item." },
      ],
    });

    const clean = normaliseTags(tags);
    const { error: upError } = await supabase
      .from("items")
      .update({ ...clean, status: "review", error: null })
      .eq("id", id);
    if (upError) throw new Error(upError.message);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof ClaudeError ? e.message : "Tagging failed. Please retry.";
    if (!(e instanceof ClaudeError)) console.error("tag failed", id, e);
    await supabase.from("items").update({ status: "failed", error: message }).eq("id", id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
