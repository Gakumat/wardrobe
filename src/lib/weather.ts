// Open-Meteo (free, no key) → a compact summary of the whole day, not just "now".

export type Period = { label: string; temp: number; feels: number; rain: number; wind: number };

export type DaySummary = {
  lat: number;
  lon: number;
  timezone: string;
  fetchedAt: string;
  current: { temp: number; feels: number; wind: number; uv: number; condition: string; isDay: boolean };
  range: { min: number; max: number; feelsMin: number; feelsMax: number };
  rainChance: number; // max % over the rest of the day
  rainMm: number;
  windMax: number; // km/h
  uvMax: number;
  condition: string; // daily headline
  periods: Period[]; // morning / afternoon / evening
  season: "summer" | "autumn" | "winter" | "spring";
};

export function conditionLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorms";
  return "Mixed";
}

export function seasonFor(date: Date, lat: number): DaySummary["season"] {
  const m = date.getMonth(); // 0 = Jan
  const north = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"] as const;
  const south = ["summer", "summer", "autumn", "autumn", "autumn", "winter", "winter", "winter", "spring", "spring", "spring", "summer"] as const;
  return (lat < 0 ? south : north)[m];
}

const round = (n: number) => Math.round(n);

type OpenMeteo = {
  timezone: string;
  current: Record<string, number>;
  hourly: { time: string[] } & Record<string, number[]>;
  daily: Record<string, number[]>;
};

export async function fetchDay(lat: number, lon: number): Promise<DaySummary> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index,is_day",
    hourly: "temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,precipitation_sum,uv_index_max,wind_speed_10m_max",
    timezone: "auto",
    forecast_days: "1",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
    next: { revalidate: 900 },
  });
  if (!res.ok) throw new Error(`Weather unavailable (${res.status})`);
  const w = (await res.json()) as OpenMeteo;
  return summarise(w, lat, lon);
}

export function summarise(w: OpenMeteo, lat: number, lon: number): DaySummary {
  const hours = w.hourly.time.map((t) => Number(t.slice(11, 13)));
  const nowHour = Number(new Date().toLocaleString("en-US", { timeZone: w.timezone, hour: "2-digit", hour12: false })) % 24;

  const period = (label: string, from: number, to: number): Period | null => {
    const idx = hours.map((h, i) => (h >= from && h < to ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) return null;
    const avg = (k: string) => idx.reduce((s, i) => s + w.hourly[k][i], 0) / idx.length;
    const max = (k: string) => Math.max(...idx.map((i) => w.hourly[k][i] ?? 0));
    return {
      label,
      temp: round(avg("temperature_2m")),
      feels: round(avg("apparent_temperature")),
      rain: round(max("precipitation_probability")),
      wind: round(max("wind_speed_10m")),
    };
  };

  const rest = hours.map((h, i) => (h >= nowHour ? i : -1)).filter((i) => i >= 0);
  const restRain = rest.length
    ? Math.max(...rest.map((i) => w.hourly.precipitation_probability[i] ?? 0))
    : w.daily.precipitation_probability_max[0];

  return {
    lat,
    lon,
    timezone: w.timezone,
    fetchedAt: new Date().toISOString(),
    current: {
      temp: round(w.current.temperature_2m),
      feels: round(w.current.apparent_temperature),
      wind: round(w.current.wind_speed_10m),
      uv: round(w.current.uv_index ?? 0),
      condition: conditionLabel(w.current.weather_code),
      isDay: w.current.is_day === 1,
    },
    range: {
      min: round(w.daily.temperature_2m_min[0]),
      max: round(w.daily.temperature_2m_max[0]),
      feelsMin: round(w.daily.apparent_temperature_min[0]),
      feelsMax: round(w.daily.apparent_temperature_max[0]),
    },
    rainChance: round(restRain ?? 0),
    rainMm: Math.round((w.daily.precipitation_sum[0] ?? 0) * 10) / 10,
    windMax: round(w.daily.wind_speed_10m_max[0]),
    uvMax: round(w.daily.uv_index_max[0] ?? 0),
    condition: conditionLabel(w.daily.weather_code[0]),
    periods: [period("Morning", 6, 11), period("Afternoon", 11, 17), period("Evening", 17, 23)].filter(
      (p): p is Period => !!p,
    ),
    season: seasonFor(new Date(), lat),
  };
}

/** Plain-English weather brief for prompts. */
export function weatherBrief(d: DaySummary, place?: string) {
  const lines = [
    `Location: ${place ?? `${d.lat.toFixed(2)}, ${d.lon.toFixed(2)}`} (${d.season} in this hemisphere)`,
    `Today: ${d.condition}. ${d.range.min}–${d.range.max}°C (feels ${d.range.feelsMin}–${d.range.feelsMax}°C).`,
    `Now: ${d.current.temp}°C, feels ${d.current.feels}°C, ${d.current.condition}.`,
    `Rain chance for the rest of today: ${d.rainChance}% (${d.rainMm} mm). Max wind ${d.windMax} km/h. UV max ${d.uvMax}.`,
    `By period: ${d.periods.map((p) => `${p.label} ${p.temp}°C (feels ${p.feels}), rain ${p.rain}%, wind ${p.wind} km/h`).join("; ")}.`,
  ];
  return lines.join("\n");
}
