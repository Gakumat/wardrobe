import { describe, expect, it } from "vitest";
import type { ProposedOutfit } from "@/lib/schema/outfit";
import { fullSignature, trioSignature } from "../novelty";
import { validateProposal } from "../validate";
import { item } from "./fixtures";

const top = item("top");
const top2 = item("top");
const top3 = item("top");
const jeans = item("bottom");
const shoes = item("shoes");
const briefs = item("underwear", { visibility_default: "functional" });
const watch = item("watch");
const aliases = new Map([
  ["i1", top],
  ["i2", jeans],
  ["i3", shoes],
  ["i4", briefs],
  ["i5", top2],
  ["i6", top3],
  ["i7", watch],
]);
const owned = new Set(["top", "bottom", "shoes", "underwear"]);
const base = { owned, wornFull: new Set<string>(), wornTrios: new Set<string>(), enforceTrio: true };

const proposal = (refs: [string, boolean][], over: Partial<ProposedOutfit> = {}): ProposedOutfit => ({
  title: "t",
  context_kind: "out",
  items: refs.map(([ref, visible]) => ({ ref, slot: "top", visible, styling_note: "" })),
  hero_ref: "i1",
  explanation: { why_it_works: "", how_to_wear: [], weather_note: "", alternate_take: "" },
  neglect_callouts: [],
  reply: "",
  ...over,
});

const complete: [string, boolean][] = [
  ["i1", true],
  ["i2", true],
  ["i3", true],
  ["i4", false],
];

describe("validateProposal", () => {
  it("accepts a complete outfit and uses real categories", () => {
    const r = validateProposal(proposal(complete), aliases, base);
    expect(r.errors).toEqual([]);
    expect(r.pieces.map((p) => p.slot)).toEqual(["top", "bottom", "shoes", "underwear"]);
    expect(r.heroId).toBe(top.id);
  });

  it("flags unknown aliases and missing essentials", () => {
    const errors = validateProposal(proposal([["i1", true], ["i99", true]]), aliases, base).errors.join(" ");
    expect(errors).toMatch(/i99/);
    expect(errors).toMatch(/bottom/);
    expect(errors).toMatch(/shoes/);
    expect(errors).toMatch(/underwear/);
  });

  it("lets an intimate outfit be just underwear", () => {
    const r = validateProposal(proposal([["i4", true]], { context_kind: "intimate", hero_ref: "i4" }), aliases, base);
    expect(r.errors).toEqual([]);
  });

  it("enforces slot caps", () => {
    const r = validateProposal(proposal([...complete, ["i5", true], ["i6", true]]), aliases, base);
    expect(r.errors.join(" ")).toMatch(/Too many top/);
  });

  it("rejects exact repeats always and trio repeats only when enforced", () => {
    const refs = [top, jeans, shoes, briefs].map((i) => ({ itemId: i.id, slot: i.category! }));
    const wornFull = new Set([fullSignature(refs)]);
    expect(
      validateProposal(proposal(complete), aliases, { ...base, wornFull, enforceTrio: false }).errors.join(),
    ).toMatch(/already been worn/);

    const wornTrios = new Set([trioSignature(refs)!]);
    const plusTop: [string, boolean][] = [...complete, ["i7", true]];
    expect(validateProposal(proposal(plusTop), aliases, { ...base, wornTrios }).errors.join()).toMatch(
      /combination has been worn/,
    );
  });

  it("checks swap constraints", () => {
    const errors = validateProposal(proposal(complete), aliases, {
      ...base,
      mustInclude: [top2.id],
      mustExclude: [shoes.id],
    }).errors.join(" ");
    expect(errors).toMatch(/must include i5/);
    expect(errors).toMatch(/swapped out/);
  });
});
