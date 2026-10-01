import { categoryLabel, type Item } from "@/lib/schema/item";

export function Swatches({ colours, size = "h-4 w-4" }: { colours: Item["colours"]; size?: string }) {
  return (
    <span className="inline-flex -space-x-1">
      {colours.map((c, i) => (
        <span
          key={i}
          title={c.name}
          className={`${size} rounded-full border border-line`}
          style={{ background: c.hex }}
        />
      ))}
    </span>
  );
}

export function ItemSummary({ item }: { item: Item }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="truncate font-medium">{item.name ?? "Untitled item"}</p>
      <p className="flex items-center gap-2 text-xs text-muted">
        <Swatches colours={item.colours} />
        <span className="truncate">
          {categoryLabel(item.category)}
          {item.subcategory ? ` · ${item.subcategory}` : ""}
        </span>
      </p>
      <div className="flex flex-wrap gap-1">
        {item.role === "hero" && <span className="chip border-accent text-accent">hero</span>}
        {item.warmth != null && <span className="chip">warmth {item.warmth}</span>}
        {item.formality != null && <span className="chip">formality {item.formality}</span>}
        {item.vibes.slice(0, 3).map((v) => (
          <span key={v} className="chip">
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}
