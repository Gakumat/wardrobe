"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { dismissGap } from "@/lib/gaps/actions";

export type Gap = { id: string; description: string; reason: string; unlock_count: number; created_at: string };

export function GapsView({ gaps, itemCount }: { gaps: Gap[]; itemCount: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const analyse = async () => {
    setRunning(true);
    setError(undefined);
    try {
      const res = await fetch("/api/gaps", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Gap analysis failed");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const last = gaps[0]?.created_at
    ? new Date(gaps[0].created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })
    : null;

  return (
    <section className="space-y-4 px-5">
      <button className="btn-primary w-full" onClick={analyse} disabled={running || itemCount < 5}>
        <Icon name="sparkle" className="h-4 w-4" />
        {running ? "Analysing your wardrobe… (~30s)" : gaps.length ? "Re-analyse" : "Analyse my wardrobe"}
      </button>
      {itemCount < 5 && <p className="text-center text-xs text-muted">Add at least 5 items first.</p>}
      {last && !running && <p className="text-center text-xs text-muted">Last analysed {last}</p>}
      {error && <p className="text-sm text-warn">{error}</p>}

      <ul className="space-y-3">
        {gaps.map((g) => (
          <li key={g.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium leading-snug">{g.description}</p>
              <button
                className="-mr-1 -mt-1 shrink-0 p-1 text-muted"
                disabled={pending}
                onClick={() => start(() => dismissGap(g.id))}
                aria-label="Dismiss"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{g.reason}</p>
            {g.unlock_count > 0 && (
              <p className="mt-3 inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                ≈ {g.unlock_count} new outfit{g.unlock_count === 1 ? "" : "s"}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
