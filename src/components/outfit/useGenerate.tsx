"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/schema/item";
import type { OutfitView, Source } from "@/lib/schema/outfit";
import type { Place } from "@/lib/location";

export type GenerateBody = {
  source: Source;
  vibe?: string;
  place?: Place | null;
  swap?: { outfitId: string; slot: Category };
  chat?: { messages: { role: "user" | "assistant"; content: string }[]; baseOutfitId?: string | null };
};

export async function requestOutfit(
  body: GenerateBody,
): Promise<{ id: string; reply: string | null; outfit: OutfitView | null }> {
  const res = await fetch("/api/outfits/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...body,
      place: body.place ? { lat: body.place.lat, lon: body.place.lon, name: body.place.name } : null,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Something went wrong (${res.status})`);
  return json;
}

/** Generate and navigate to the new outfit, with loading + error state. */
export function useGenerate() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async (body: GenerateBody, label: string) => {
    setBusy(label);
    setError(null);
    try {
      const { id } = await requestOutfit(body);
      router.push(`/outfit/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };
  return { busy, error, generate, clearError: () => setError(null) };
}

const MESSAGES = [
  "Rifling through the wardrobe",
  "Checking the sky",
  "Skipping anything you've worn lately",
  "Weighing colour against colour",
  "Balancing proportions",
  "Deciding what gets tucked",
  "Writing up the styling notes",
];

export function GeneratingOverlay({ label }: { label: string | null }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!label) return;
    setI(0);
    const t = setInterval(() => setI((n) => (n + 1) % MESSAGES.length), 3200);
    return () => clearInterval(t);
  }, [label]);
  if (!label) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-bg/92 px-8 text-center backdrop-blur">
      <div className="relative h-14 w-14">
        <span className="absolute inset-0 animate-ping rounded-full bg-accent/30" />
        <span className="absolute inset-3 rounded-full bg-accent" />
      </div>
      <div>
        <p className="font-serif text-3xl">{label}</p>
        <p className="mt-2 text-sm text-muted">{MESSAGES[i]}…</p>
        <p className="mt-6 text-xs text-muted">Usually 20–40 seconds</p>
      </div>
    </div>
  );
}
