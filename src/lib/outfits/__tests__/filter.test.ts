import { describe, expect, it } from "vitest";
import type { DaySummary } from "@/lib/weather";
import { filterPool } from "../filter";
import { item } from "./fixtures";

const day = (feelsMin: number, feelsMax: number, rainChance = 0): DaySummary => ({
  lat: -37.8,
  lon: 145,
  timezone: "Australia/Melbourne",
  fetchedAt: "",
  current: { temp: feelsMax, feels: feelsMax, wind: 10, uv: 3, condition: "Clear", isDay: true },
  range: { min: feelsMin, max: feelsMax, feelsMin, feelsMax },
  rainChance,
  rainMm: 0,
  windMax: 10,
  uvMax: 3,
  condition: "Clear",
  periods: [],
  season: "spring",
});

describe("filterPool", () => {
  it("drops heavy pieces on a hot day", () => {
    const coat = item("outerwear", { warmth: 5 });
    const jumper = item("midlayer", { warmth: 4 });
    const tee = item("top", { warmth: 1 });
    expect(filterPool([coat, jumper, tee], day(22, 31)).pool).toEqual([tee]);
  });

  it("keeps a waterproof shell on a hot, wet day", () => {
    const shell = item("outerwear", { warmth: 3, weather_resistance: { waterproof: true } });
    expect(filterPool([shell], day(22, 30, 80)).pool).toContain(shell);
  });

  it("drops shorts on a cold day but never empties a protected category", () => {
    const shorts = item("bottom", { warmth: 1 });
    const jeans = item("bottom", { warmth: 3 });
    expect(filterPool([shorts, jeans], day(3, 11)).pool).toEqual([jeans]);
    const res = filterPool([shorts], day(3, 11));
    expect(res.pool).toEqual([shorts]);
    expect(res.notes[0]).toMatch(/bottom/);
  });

  it("ignores items that are not active", () => {
    expect(filterPool([item("top", { status: "review" })], null).pool).toEqual([]);
  });
});
