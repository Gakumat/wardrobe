"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { GeneratingOverlay, useGenerate } from "@/components/outfit/useGenerate";
import { useLocation } from "@/lib/location";
import { WeatherStrip } from "./WeatherStrip";

const VIBES = [
  "Moody minimal",
  "Lazy Sunday",
  "Going out",
  "Smart casual",
  "70s",
  "Quiet luxury",
  "Workwear",
  "Gallery opening",
  "Outdoorsy",
  "Date night",
];

export function HomeControls({
  fallback,
  canGenerate,
}: {
  fallback: { lat: number; lon: number; name: string } | null;
  canGenerate: boolean;
}) {
  const place = useLocation(fallback);
  const { busy, error, generate } = useGenerate();
  const [vibe, setVibe] = useState("");
  const [showVibes, setShowVibes] = useState(false);

  const disabled = !!busy || !canGenerate;

  return (
    <section className="space-y-3 px-5">
      <GeneratingOverlay label={busy} />
      <WeatherStrip place={place} />

      <button
        className="group relative w-full overflow-hidden rounded-3xl bg-accent px-6 py-7 text-left text-accent-ink transition active:scale-[0.99] disabled:opacity-50"
        disabled={disabled}
        onClick={() => generate({ source: "today", place }, "Dressing you for today")}
      >
        <span className="block font-serif text-4xl leading-none">Today&apos;s outfit</span>
        <span className="mt-2 block text-sm opacity-80">For the weather, and something new</span>
        <Icon name="sun" className="absolute right-6 top-1/2 h-10 w-10 -translate-y-1/2 opacity-70" />
      </button>

      <div className="grid grid-cols-2 gap-3">
        <button
          className="card flex items-center gap-3 px-4 py-4 text-left disabled:opacity-50"
          disabled={disabled}
          onClick={() => generate({ source: "shuffle", place }, "Shuffling")}
        >
          <Icon name="shuffle" className="h-6 w-6 text-accent" />
          <span>
            <span className="block font-medium">Shuffle</span>
            <span className="text-xs text-muted">Surprise me</span>
          </span>
        </button>
        <button
          className="card flex items-center gap-3 px-4 py-4 text-left disabled:opacity-50"
          disabled={disabled}
          onClick={() => setShowVibes((s) => !s)}
        >
          <Icon name="sparkle" className="h-6 w-6 text-accent" />
          <span>
            <span className="block font-medium">Vibe</span>
            <span className="text-xs text-muted">Pick a mood</span>
          </span>
        </button>
      </div>

      {showVibes && (
        <div className="card space-y-3 p-4">
          <div className="flex flex-wrap gap-1.5">
            {VIBES.map((v) => (
              <button
                key={v}
                className="chip py-1.5 text-sm"
                disabled={disabled}
                onClick={() => generate({ source: "vibe", vibe: v, place }, v)}
              >
                {v}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (vibe.trim()) generate({ source: "vibe", vibe: vibe.trim(), place }, vibe.trim());
            }}
          >
            <input
              className="input"
              placeholder="Or type one: 'French film student'"
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
            />
            <button className="btn-primary px-4" disabled={disabled || !vibe.trim()} aria-label="Go">
              <Icon name="send" className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      {error && <p className="text-sm text-warn">{error}</p>}
    </section>
  );
}
