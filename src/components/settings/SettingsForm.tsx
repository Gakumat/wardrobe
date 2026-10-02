"use client";

import { useState, useTransition } from "react";
import { FALLBACK_LOCATION, MODEL_ALLOWLIST } from "@/lib/config";
import { forgetLearned, savePreferences, setPassword } from "@/lib/settings/actions";

type Prefs = {
  likes: string;
  dislikes: string;
  learned: { at: string; note: string }[];
  location_name: string | null;
  lat: number | null;
  lon: number | null;
  model: string | null;
};

type GeoResult = { name: string; admin1?: string; country?: string; latitude: number; longitude: number };

export function SettingsForm({ prefs }: { prefs: Prefs }) {
  return (
    <div className="space-y-6">
      <StyleSection prefs={prefs} />
      <LearnedSection learned={prefs.learned} />
      <LocationSection prefs={prefs} />
      <ModelSection model={prefs.model} />
      <PasswordSection />
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-3 p-4">
      <div>
        <h2 className="font-medium">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function useSave() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<unknown>, ok = "Saved") =>
    start(async () => {
      try {
        await fn();
        setMsg({ ok: true, text: ok });
      } catch (e) {
        setMsg({ ok: false, text: (e as Error).message });
      }
    });
  const note = msg && <p className={`text-xs ${msg.ok ? "text-accent" : "text-warn"}`}>{msg.text}</p>;
  return { pending, run, note };
}

function StyleSection({ prefs }: { prefs: Prefs }) {
  const [likes, setLikes] = useState(prefs.likes);
  const [dislikes, setDislikes] = useState(prefs.dislikes);
  const { pending, run, note } = useSave();
  return (
    <Section title="Your style" hint="Claude reads this every time it dresses you.">
      <label className="block text-xs font-medium text-muted">
        Things I love
        <textarea
          className="input mt-1 min-h-20"
          placeholder="e.g. tonal outfits, a bit of 70s, rolled sleeves, loafers with everything"
          value={likes}
          onChange={(e) => setLikes(e.target.value)}
        />
      </label>
      <label className="block text-xs font-medium text-muted">
        Things I avoid
        <textarea
          className="input mt-1 min-h-20"
          placeholder="e.g. skinny fits, logos, tucking in t-shirts, brown with black"
          value={dislikes}
          onChange={(e) => setDislikes(e.target.value)}
        />
      </label>
      <button className="btn-primary w-full" disabled={pending} onClick={() => run(() => savePreferences({ likes, dislikes }))}>
        Save style
      </button>
      {note}
    </Section>
  );
}

function LearnedSection({ learned }: { learned: Prefs["learned"] }) {
  const { pending, run } = useSave();
  if (!learned.length) return null;
  return (
    <Section title="Learned from skipped outfits" hint="Reasons you gave for 'Not for me'. Remove any that no longer apply.">
      <ul className="space-y-2">
        {learned.map((l, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="flex-1 text-muted">{l.note}</span>
            <button className="px-1 text-muted" disabled={pending} onClick={() => run(() => forgetLearned(i))} aria-label="Forget">
              ×
            </button>
          </li>
        ))}
      </ul>
      <button className="btn-ghost w-full py-2" disabled={pending} onClick={() => run(() => forgetLearned("all"))}>
        Forget all
      </button>
    </Section>
  );
}

function LocationSection({ prefs }: { prefs: Prefs }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const { pending, run, note } = useSave();
  const current = prefs.location_name ?? `${FALLBACK_LOCATION.name} (default)`;

  const search = async () => {
    if (!query.trim()) return;
    const r = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en`,
    );
    const j = await r.json();
    setResults(j.results ?? []);
  };

  return (
    <Section title="Fallback location" hint="Used when your phone doesn't share its location.">
      <p className="text-sm">
        Currently: <span className="font-medium">{current}</span>
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <input className="input" placeholder="Search a city or suburb" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="btn-ghost">Search</button>
      </form>
      {results.length > 0 && (
        <ul className="space-y-1">
          {results.map((g, i) => (
            <li key={i}>
              <button
                className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-surface-2"
                disabled={pending}
                onClick={() => {
                  setResults([]);
                  setQuery("");
                  run(() => savePreferences({ location_name: g.name, lat: g.latitude, lon: g.longitude }));
                }}
              >
                {g.name}
                <span className="text-muted">{[g.admin1, g.country].filter(Boolean).map((s) => `, ${s}`).join("")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {prefs.location_name && (
        <button
          className="text-xs text-muted underline"
          onClick={() => run(() => savePreferences({ location_name: null, lat: null, lon: null }))}
        >
          Reset to Melbourne
        </button>
      )}
      {note}
    </Section>
  );
}

function ModelSection({ model }: { model: string | null }) {
  const { pending, run, note } = useSave();
  return (
    <Section title="AI model" hint="Used for tagging, outfits, chat and gaps.">
      <select
        className="input"
        defaultValue={model ?? MODEL_ALLOWLIST[0].id}
        disabled={pending}
        onChange={(e) => run(() => savePreferences({ model: e.target.value }))}
      >
        {MODEL_ALLOWLIST.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      {note}
    </Section>
  );
}

function PasswordSection() {
  const [pw, setPw] = useState("");
  const { pending, run, note } = useSave();
  return (
    <Section
      title="Home-screen app sign-in"
      hint="Email links open in Safari, not the installed app. Set a password once and sign in to the app with email + password."
    >
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await setPassword(pw);
            setPw("");
          }, "Password set. Use it on the app's sign-in screen.");
        }}
      >
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          placeholder="New password (8+ characters)"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <button className="btn-primary" disabled={pending || pw.length < 8}>
          Set
        </button>
      </form>
      {note}
    </Section>
  );
}
