import { NextResponse } from "next/server";
import { z } from "zod";
import { ClaudeError } from "@/lib/claude";
import { CATEGORY_IDS } from "@/lib/schema/item";
import { composeOutfit, ComposeError } from "@/lib/outfits/compose";
import { loadOutfit } from "@/lib/outfits/load";
import { requireUser, UnauthorizedError } from "@/lib/supabase/server";

export const maxDuration = 120;

const Body = z.object({
  source: z.enum(["today", "shuffle", "vibe", "chat", "swap"]),
  vibe: z.string().max(200).optional(),
  place: z.object({ lat: z.number(), lon: z.number(), name: z.string().optional() }).nullish(),
  swap: z.object({ outfitId: z.uuid(), slot: z.enum(CATEGORY_IDS) }).optional(),
  chat: z
    .object({
      messages: z
        .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
        .min(1)
        .max(30),
      baseOutfitId: z.uuid().nullish(),
    })
    .optional(),
});

export async function POST(req: Request) {
  try {
    const { supabase } = await requireUser();
    const body = Body.parse(await req.json());
    if (body.source === "vibe" && !body.vibe?.trim()) {
      return NextResponse.json({ error: "Pick or type a vibe first." }, { status: 400 });
    }
    const result = await composeOutfit(supabase, body);
    // Chat renders the outfit inline, so send it back with the reply.
    const outfit = body.source === "chat" ? await loadOutfit(supabase, result.id) : null;
    return NextResponse.json({ ...result, outfit });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof ComposeError || e instanceof ClaudeError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Bad request" }, { status: 400 });
    console.error("generate failed", e);
    return NextResponse.json({ error: "Something went wrong building the outfit. Please retry." }, { status: 500 });
  }
}
