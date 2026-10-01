"use client";

import { useState, useTransition } from "react";
import { updateItem } from "@/lib/items/actions";
import {
  CATEGORIES,
  FABRIC_WEIGHTS,
  FITS,
  LAYERING_FLAGS,
  PATTERNS,
  ROLES,
  SEASONS,
  STYLING_FLAGS,
  VIBE_SUGGESTIONS,
  VISIBILITY,
  WEATHER_FLAGS,
  flagLabel,
  type Colour,
  type Item,
  type ItemPatch,
} from "@/lib/schema/item";

type Draft = Pick<
  Item,
  | "name"
  | "category"
  | "subcategory"
  | "colours"
  | "pattern"
  | "material"
  | "fabric_weight"
  | "warmth"
  | "weather_resistance"
  | "formality"
  | "seasons"
  | "fit"
  | "vibes"
  | "role"
  | "layering"
  | "styling_properties"
  | "visibility_default"
  | "notes"
>;

const KEYS: (keyof Draft)[] = [
  "name",
  "category",
  "subcategory",
  "colours",
  "pattern",
  "material",
  "fabric_weight",
  "warmth",
  "weather_resistance",
  "formality",
  "seasons",
  "fit",
  "vibes",
  "role",
  "layering",
  "styling_properties",
  "visibility_default",
  "notes",
];

const pick = (item: Item): Draft =>
  Object.fromEntries(KEYS.map((k) => [k, item[k]])) as Draft;

export function ItemEditor({
  item,
  onDone,
  saveLabel = "Save",
}: {
  item: Item;
  onDone?: () => void;
  saveLabel?: string;
}) {
  const [draft, setDraft] = useState<Draft>(() => pick(item));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const low = new Set(item.low_confidence);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const save = () =>
    start(async () => {
      const original = pick(item);
      const patch = Object.fromEntries(
        KEYS.filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(original[k])).map((k) => [
          k,
          draft[k],
        ]),
      ) as ItemPatch;
      try {
        if (Object.keys(patch).length) await updateItem(item.id, patch);
        setError(undefined);
        onDone?.();
      } catch (e) {
        setError((e as Error).message);
      }
    });

  return (
    <div className="space-y-5">
      {low.size > 0 && (
        <p className="rounded-xl bg-warn/10 px-3 py-2 text-xs text-warn">
          Highlighted fields were guesses. Worth a quick check.
        </p>
      )}

      <Field label="Name" flagged={low.has("name")}>
        <input className="input" value={draft.name ?? ""} onChange={(e) => set("name", e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" flagged={low.has("category")}>
          <select
            className="input"
            value={draft.category ?? ""}
            onChange={(e) => set("category", e.target.value as Draft["category"])}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type" flagged={low.has("subcategory")}>
          <input
            className="input"
            value={draft.subcategory ?? ""}
            onChange={(e) => set("subcategory", e.target.value)}
          />
        </Field>
      </div>

      <Field label="Colours" flagged={low.has("colours")}>
        <ColoursInput value={draft.colours} onChange={(v) => set("colours", v)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Pattern" flagged={low.has("pattern")}>
          <EnumSelect options={PATTERNS} value={draft.pattern} onChange={(v) => set("pattern", v)} />
        </Field>
        <Field label="Material" flagged={low.has("material")}>
          <input
            className="input"
            value={draft.material ?? ""}
            onChange={(e) => set("material", e.target.value)}
          />
        </Field>
        <Field label="Fabric weight" flagged={low.has("fabric_weight")}>
          <EnumSelect
            options={FABRIC_WEIGHTS}
            value={draft.fabric_weight}
            onChange={(v) => set("fabric_weight", v)}
          />
        </Field>
        <Field label="Fit" flagged={low.has("fit")}>
          <EnumSelect options={FITS} value={draft.fit} onChange={(v) => set("fit", v)} />
        </Field>
      </div>

      <Field label="Warmth" hint="1 barely there · 5 very warm" flagged={low.has("warmth")}>
        <Scale value={draft.warmth} onChange={(v) => set("warmth", v)} />
      </Field>
      <Field label="Formality" hint="1 lounge · 3 smart-casual · 5 formal" flagged={low.has("formality")}>
        <Scale value={draft.formality} onChange={(v) => set("formality", v)} />
      </Field>

      <Field label="Seasons" flagged={low.has("seasons")}>
        <ChipSet
          options={SEASONS}
          selected={draft.seasons}
          onChange={(v) => set("seasons", v as Draft["seasons"])}
        />
      </Field>

      <Field label="Vibes" flagged={low.has("vibes")}>
        <VibesInput value={draft.vibes} onChange={(v) => set("vibes", v)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Role" flagged={low.has("role")}>
          <EnumSelect options={ROLES} value={draft.role} onChange={(v) => set("role", v)} />
        </Field>
        <Field label="Shown in outfits" flagged={low.has("visibility_default")}>
          <EnumSelect
            options={VISIBILITY}
            value={draft.visibility_default}
            onChange={(v) => set("visibility_default", v)}
          />
        </Field>
      </div>

      <Field label="Weather" flagged={low.has("weather_resistance")}>
        <FlagSet
          options={WEATHER_FLAGS}
          value={draft.weather_resistance}
          onChange={(v) => set("weather_resistance", v)}
        />
      </Field>
      <Field label="Layering" flagged={low.has("layering")}>
        <FlagSet options={LAYERING_FLAGS} value={draft.layering} onChange={(v) => set("layering", v)} />
      </Field>
      <Field label="Styling" flagged={low.has("styling_properties")}>
        <FlagSet
          options={STYLING_FLAGS}
          value={draft.styling_properties}
          onChange={(v) => set("styling_properties", v)}
        />
      </Field>

      <Field label="Notes">
        <textarea
          className="input min-h-20"
          value={draft.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
        />
      </Field>

      {error && <p className="text-sm text-warn">{error}</p>}
      <button className="btn-primary w-full" onClick={save} disabled={pending}>
        {pending ? "Saving…" : saveLabel}
      </button>
    </div>
  );
}

function Field({
  label,
  hint,
  flagged,
  children,
}: {
  label: string;
  hint?: string;
  flagged?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`block ${flagged ? "rounded-xl ring-2 ring-warn/60 ring-offset-4 ring-offset-surface" : ""}`}>
      <span className="mb-1.5 flex items-baseline justify-between text-xs font-medium text-muted">
        <span>
          {label}
          {flagged && <span className="ml-1.5 text-warn">check</span>}
        </span>
        {hint && <span className="font-normal">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

function EnumSelect<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <select className="input capitalize" value={value ?? ""} onChange={(e) => onChange(e.target.value as T)}>
      {value == null && <option value="">-</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function Scale({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          onClick={() => onChange(n)}
          className={`rounded-xl border py-2.5 text-sm ${
            value === n ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm capitalize ${
        on ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function ChipSet({
  options,
  selected,
  onChange,
}: {
  options: readonly string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <Toggle
          key={o}
          on={selected.includes(o)}
          onClick={() => onChange(selected.includes(o) ? selected.filter((s) => s !== o) : [...selected, o])}
        >
          {o}
        </Toggle>
      ))}
    </div>
  );
}

function FlagSet<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: Partial<Record<T, boolean>>;
  onChange: (v: Record<T, boolean>) => void;
}) {
  const full = Object.fromEntries(options.map((o) => [o, !!value[o]])) as Record<T, boolean>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <Toggle key={o} on={full[o]} onClick={() => onChange({ ...full, [o]: !full[o] })}>
          {flagLabel(o)}
        </Toggle>
      ))}
    </div>
  );
}

function VibesInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState("");
  const add = (v: string) => {
    const clean = v.trim().toLowerCase();
    if (clean && !value.includes(clean)) onChange([...value, clean]);
    setText("");
  };
  const suggestions = VIBE_SUGGESTIONS.filter((s) => !value.includes(s)).slice(0, 8);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((v) => (
          <Toggle key={v} on onClick={() => onChange(value.filter((x) => x !== v))}>
            {v} ×
          </Toggle>
        ))}
      </div>
      <input
        className="input"
        placeholder="Add a vibe and press enter"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(text);
          }
        }}
        onBlur={() => text && add(text)}
      />
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button key={s} type="button" className="chip text-muted" onClick={() => add(s)}>
            + {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function ColoursInput({ value, onChange }: { value: Colour[]; onChange: (v: Colour[]) => void }) {
  const update = (i: number, p: Partial<Colour>) =>
    onChange(value.map((c, j) => (j === i ? { ...c, ...p } : c)));
  return (
    <div className="space-y-2">
      {value.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="color"
            value={c.hex}
            onChange={(e) => update(i, { hex: e.target.value })}
            className="h-11 w-11 shrink-0 cursor-pointer rounded-xl border border-line bg-surface p-1"
          />
          <input className="input" value={c.name} onChange={(e) => update(i, { name: e.target.value })} />
          <span className="w-10 shrink-0 text-right text-xs text-muted">{Math.round(c.proportion * 100)}%</span>
          <button
            type="button"
            className="px-2 text-muted"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            aria-label="Remove colour"
          >
            ×
          </button>
        </div>
      ))}
      {value.length < 4 && (
        <button
          type="button"
          className="chip text-muted"
          onClick={() => onChange([...value, { name: "", hex: "#888888", proportion: 0.1 }])}
        >
          + Add colour
        </button>
      )}
    </div>
  );
}
