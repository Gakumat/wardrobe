import { describe, expect, it } from "vitest";
import { fullSignature, neglectLabel, neglectScore, pickNeglected, trioSignature } from "../novelty";

const now = new Date("2026-10-01T00:00:00Z").getTime();
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

describe("signatures", () => {
  it("are order-independent", () => {
    const a = [
      { itemId: "b", slot: "top" as const },
      { itemId: "a", slot: "bottom" as const },
    ];
    expect(fullSignature(a)).toBe(fullSignature([...a].reverse()));
  });

  it("trio ignores accessories and needs two core pieces", () => {
    const p = [
      { itemId: "t", slot: "top" as const },
      { itemId: "b", slot: "bottom" as const },
      { itemId: "s", slot: "shoes" as const },
      { itemId: "w", slot: "watch" as const },
    ];
    expect(trioSignature(p)).toBe("b+s+t");
    expect(trioSignature([p[0], p[3]])).toBeNull();
  });
});

describe("neglect", () => {
  it("scores never-worn older items highest and recent favourites lowest", () => {
    expect(neglectScore({ times_worn: 0, last_worn_at: null, created_at: daysAgo(30) }, now)).toBe(1);
    expect(neglectScore({ times_worn: 12, last_worn_at: daysAgo(1), created_at: daysAgo(300) }, now)).toBeLessThan(0.15);
    expect(neglectScore({ times_worn: 2, last_worn_at: daysAgo(90), created_at: daysAgo(300) }, now)).toBeGreaterThan(0.8);
  });

  it("labels in weeks or months", () => {
    expect(neglectLabel({ times_worn: 1, last_worn_at: daysAgo(42), created_at: daysAgo(100) }, now)).toBe(
      "not worn in 6 weeks",
    );
    expect(neglectLabel({ times_worn: 1, last_worn_at: daysAgo(100), created_at: daysAgo(200) }, now)).toBe(
      "not worn in 3 months",
    );
    expect(neglectLabel({ times_worn: 3, last_worn_at: daysAgo(3), created_at: daysAgo(200) }, now)).toBeNull();
  });

  it("pickNeglected favours neglected items", () => {
    const fresh = { id: "fresh", times_worn: 20, last_worn_at: new Date().toISOString(), created_at: daysAgo(400) };
    const dusty = { id: "dusty", times_worn: 0, last_worn_at: null, created_at: daysAgo(400) };
    let dustyWins = 0;
    for (let i = 0; i < 400; i++) if (pickNeglected([fresh, dusty])?.id === "dusty") dustyWins++;
    expect(dustyWins).toBeGreaterThan(280);
  });
});
