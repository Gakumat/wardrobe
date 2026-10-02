"use client";

import { useEffect, useState } from "react";
import { FALLBACK_LOCATION } from "./config";

export type Place = { lat: number; lon: number; name: string; source: "gps" | "fallback" };

const KEY = "wardrobe.place";
const MAX_AGE = 3 * 60 * 60 * 1000; // re-check GPS every 3h

function read(): (Place & { at: number }) | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}

async function placeName(lat: number, lon: number) {
  try {
    const r = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    );
    const j = await r.json();
    return (j.locality || j.city || j.principalSubdivision || "Here") as string;
  } catch {
    return "Here";
  }
}

/**
 * Browser location: cached GPS if fresh, otherwise asks once (the browser remembers
 * the permission). Falls back to the Settings location, then Melbourne.
 */
export function useLocation(fallback?: { lat: number; lon: number; name: string } | null) {
  const base: Place = { ...(fallback ?? FALLBACK_LOCATION), source: "fallback" };
  const [place, setPlace] = useState<Place | null>(null);

  useEffect(() => {
    const cached = read();
    if (cached) setPlace(cached);
    if (cached && cached.source === "gps" && Date.now() - cached.at < MAX_AGE) return;
    if (!("geolocation" in navigator)) {
      if (!cached) setPlace(base);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Math.round(pos.coords.latitude * 1000) / 1000;
        const lon = Math.round(pos.coords.longitude * 1000) / 1000;
        const next: Place = { lat, lon, name: await placeName(lat, lon), source: "gps" };
        try {
          localStorage.setItem(KEY, JSON.stringify({ ...next, at: Date.now() }));
        } catch {}
        setPlace(next);
      },
      () => {
        if (!cached || cached.source !== "gps") setPlace(base);
      },
      { maximumAge: MAX_AGE, timeout: 10000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return place;
}
