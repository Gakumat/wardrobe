"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { acceptAll, acceptItem, deleteItem } from "@/lib/items/actions";
import { tagItem, uploadAndTag } from "@/lib/items/upload";
import type { ItemWithUrls } from "@/lib/schema/item";
import { ItemEditor } from "./ItemEditor";
import { ItemSummary } from "./ItemSummary";

export function ReviewQueue({ items }: { items: ItemWithUrls[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const reviewable = items.filter((i) => i.status === "review");
  const tagging = items.some((i) => i.status === "tagging" || i.status === "pending");

  // Items can be tagged by an upload running elsewhere; poll while any are in flight.
  useEffect(() => {
    if (!tagging) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [tagging, router]);

  if (items.length === 0) return null;

  return (
    <section className="mt-8 px-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-serif text-2xl">To review</h2>
        {reviewable.length > 1 && (
          <button className="btn-primary py-2" disabled={pending} onClick={() => start(() => acceptAll())}>
            <Icon name="check" className="h-4 w-4" /> Accept all {reviewable.length}
          </button>
        )}
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <ReviewCard key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

function ReviewCard({ item }: { item: ItemWithUrls }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const retakeInput = useRef<HTMLInputElement>(null);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
      router.refresh();
    }
  };

  const isTagging = item.status === "tagging" || item.status === "pending";

  return (
    <li className="card overflow-hidden">
      <div className="flex gap-3 p-3">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-flatlay p-1.5">
          {item.cutout_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.cutout_url} alt="" className="max-h-full max-w-full object-contain" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {isTagging ? (
            <p className="flex h-full items-center text-sm text-muted">
              <span className="mr-2 h-3 w-3 animate-pulse rounded-full bg-accent" /> Tagging…
            </p>
          ) : item.status === "failed" ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-warn">Tagging failed</p>
              <p className="text-xs text-muted">{item.error}</p>
            </div>
          ) : (
            <>
              <ItemSummary item={item} />
              {item.low_confidence.length > 0 && (
                <p className="mt-1.5 text-xs text-warn">
                  {item.low_confidence.length} field{item.low_confidence.length === 1 ? "" : "s"} to check
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {!isTagging && (
        <div className="flex items-center gap-2 border-t border-line px-3 py-2.5">
          {item.status === "review" && (
            <button
              className="btn-primary flex-1 py-2"
              disabled={!!busy}
              onClick={() => run("accept", () => acceptItem(item.id))}
            >
              <Icon name="check" className="h-4 w-4" /> {busy === "accept" ? "…" : "Accept"}
            </button>
          )}
          {item.status === "failed" && (
            <button
              className="btn-primary flex-1 py-2"
              disabled={!!busy}
              onClick={() => run("retry", () => tagItem(item.id))}
            >
              <Icon name="refresh" className="h-4 w-4" /> {busy === "retry" ? "Tagging…" : "Retry"}
            </button>
          )}
          {item.status === "review" && (
            <button className="btn-ghost py-2" onClick={() => setEditing((e) => !e)}>
              {editing ? "Close" : "Edit"}
            </button>
          )}
          <button
            className="btn-ghost py-2"
            disabled={!!busy}
            onClick={() => retakeInput.current?.click()}
            aria-label="Retake photo"
          >
            <Icon name="camera" className="h-4 w-4" />
            {busy === "retake" && "…"}
          </button>
          <button
            className="btn-ghost py-2"
            disabled={!!busy}
            onClick={() => confirm("Delete this item?") && run("delete", () => deleteItem(item.id))}
            aria-label="Delete"
          >
            <Icon name="trash" className="h-4 w-4" />
          </button>
          <input
            ref={retakeInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) run("retake", () => uploadAndTag(f, () => {}, item.id));
            }}
          />
        </div>
      )}
      {error && <p className="px-3 pb-3 text-xs text-warn">{error}</p>}

      {editing && (
        <div className="border-t border-line p-4">
          <ItemEditor
            item={item}
            saveLabel="Save & accept"
            onDone={() => {
              setEditing(false);
              run("accept", () => acceptItem(item.id));
            }}
          />
        </div>
      )}
    </li>
  );
}
