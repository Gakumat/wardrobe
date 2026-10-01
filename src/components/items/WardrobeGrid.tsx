"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CATEGORIES, type ItemWithUrls } from "@/lib/schema/item";

type Sort = "least-worn" | "newest" | "name";

export function WardrobeGrid({ items }: { items: ItemWithUrls[] }) {
  const [category, setCategory] = useState<string>("all");
  const [colour, setColour] = useState<string>("");
  const [vibe, setVibe] = useState<string>("");
  const [sort, setSort] = useState<Sort>("least-worn");

  const present = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((i) => i.category && counts.set(i.category, (counts.get(i.category) ?? 0) + 1));
    return CATEGORIES.filter((c) => counts.has(c.id)).map((c) => ({ ...c, count: counts.get(c.id)! }));
  }, [items]);
  const colours = useMemo(
    () => [...new Set(items.flatMap((i) => i.colours.map((c) => c.name)))].sort(),
    [items],
  );
  const vibes = useMemo(() => [...new Set(items.flatMap((i) => i.vibes))].sort(), [items]);

  const shown = useMemo(() => {
    const list = items.filter(
      (i) =>
        (category === "all" || i.category === category) &&
        (!colour || i.colours.some((c) => c.name === colour)) &&
        (!vibe || i.vibes.includes(vibe)),
    );
    const time = (s?: string | null) => (s ? new Date(s).getTime() : 0);
    return list.sort((a, b) => {
      if (sort === "newest") return time(b.created_at) - time(a.created_at);
      if (sort === "name") return (a.name ?? "").localeCompare(b.name ?? "");
      return (a.times_worn ?? 0) - (b.times_worn ?? 0) || time(a.last_worn_at) - time(b.last_worn_at);
    });
  }, [items, category, colour, vibe, sort]);

  return (
    <>
      <div className="-mx-5 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        <div className="flex w-max gap-1.5">
          <Pill on={category === "all"} onClick={() => setCategory("all")}>
            All {items.length}
          </Pill>
          {present.map((c) => (
            <Pill key={c.id} on={category === c.id} onClick={() => setCategory(c.id)}>
              {c.label} {c.count}
            </Pill>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <select className="input py-2 text-sm capitalize" value={colour} onChange={(e) => setColour(e.target.value)}>
          <option value="">Any colour</option>
          {colours.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className="input py-2 text-sm capitalize" value={vibe} onChange={(e) => setVibe(e.target.value)}>
          <option value="">Any vibe</option>
          {vibes.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select className="input py-2 text-sm" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="least-worn">Least worn</option>
          <option value="newest">Newest</option>
          <option value="name">A–Z</option>
        </select>
      </div>

      {shown.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">Nothing matches those filters.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {shown.map((i) => (
            <li key={i.id}>
              <Link href={`/wardrobe/${i.id}`} className="block">
                <div className="flex aspect-square items-center justify-center rounded-2xl bg-flatlay p-2.5">
                  {i.cutout_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.cutout_url} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                  )}
                </div>
                <p className="mt-1 truncate text-xs">{i.name}</p>
                <p className="text-[11px] text-muted">
                  {i.times_worn ? `worn ${i.times_worn}×` : "never worn"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm ${
        on ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink"
      }`}
    >
      {children}
    </button>
  );
}
