"use client";

import { useEffect, useState } from "react";
import type { Place } from "@/lib/location";
import type { DaySummary } from "@/lib/weather";

export function WeatherStrip({ place }: { place: Place | null }) {
  const [day, setDay] = useState<DaySummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!place) return;
    let live = true;
    fetch(`/api/weather?lat=${place.lat}&lon=${place.lon}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => live && setDay(d))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [place]);

  if (error) return <div className="card px-4 py-3 text-sm text-muted">Weather unavailable right now.</div>;
  if (!day || !place) return <div className="card h-[92px] animate-pulse" />;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-4xl leading-none">{day.current.temp}°</span>
          <span className="text-sm text-muted">feels {day.current.feels}°</span>
        </div>
        <div className="text-right text-xs text-muted">
          <p className="font-medium text-ink">{day.condition}</p>
          <p>
            {place.name}
            {place.source === "fallback" ? " (default)" : ""}
          </p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-4 border-t border-line text-center text-[11px]">
        <Stat label="Range" value={`${day.range.min}–${day.range.max}°`} />
        <Stat label="Rain" value={`${day.rainChance}%`} warn={day.rainChance >= 50} />
        <Stat label="Wind" value={`${day.windMax} km/h`} warn={day.windMax >= 35} />
        <Stat label="UV" value={`${day.uvMax}`} warn={day.uvMax >= 6} />
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="border-r border-line px-1 py-2 last:border-r-0">
      <p className="text-muted">{label}</p>
      <p className={`mt-0.5 font-medium ${warn ? "text-warn" : ""}`}>{value}</p>
    </div>
  );
}
