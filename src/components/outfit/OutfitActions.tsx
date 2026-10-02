"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { setFavourite, skipOutfit, undoWore, woreIt } from "@/lib/outfits/actions";
import type { OutfitView } from "@/lib/schema/outfit";

export function OutfitActions({ outfit }: { outfit: OutfitView }) {
  const [pending, start] = useTransition();
  const [skipping, setSkipping] = useState(false);
  const [reason, setReason] = useState("");
  const worn = outfit.status === "worn";

  if (outfit.status === "skipped") {
    return (
      <p className="card px-4 py-3 text-sm text-muted">
        You passed on this one. Noted for next time.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {worn ? (
          <button className="btn-ghost flex-1" disabled={pending} onClick={() => start(() => undoWore(outfit.id))}>
            <Icon name="check" className="h-4 w-4" /> Worn · undo
          </button>
        ) : (
          <button className="btn-primary flex-1" disabled={pending} onClick={() => start(() => woreIt(outfit.id))}>
            <Icon name="check" className="h-4 w-4" /> Wore it
          </button>
        )}
        <button
          className={`btn-ghost ${outfit.favourite ? "text-warn" : ""}`}
          disabled={pending}
          onClick={() => start(() => setFavourite(outfit.id, !outfit.favourite))}
          aria-label={outfit.favourite ? "Remove from saved" : "Save"}
        >
          <Icon name="heart" className="h-4 w-4" filled={outfit.favourite} />
          {outfit.favourite ? "Saved" : "Save"}
        </button>
        {!worn && (
          <button className="btn-ghost" disabled={pending} onClick={() => setSkipping((s) => !s)}>
            <Icon name="x" className="h-4 w-4" />
          </button>
        )}
      </div>

      {skipping && (
        <div className="card space-y-2 p-3">
          <p className="text-sm font-medium">Not for you? What&apos;s off?</p>
          <p className="text-xs text-muted">Optional. It shapes future suggestions.</p>
          <div className="flex flex-wrap gap-1.5">
            {["Too formal", "Too casual", "Colours clash", "Not warm enough", "Too warm", "Don't like the shoes"].map((r) => (
              <button key={r} className="chip" onClick={() => setReason(r)}>
                {r}
              </button>
            ))}
          </div>
          <input
            className="input"
            placeholder="e.g. I never wear those jeans with sneakers"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            className="btn-primary w-full"
            disabled={pending}
            onClick={() => start(() => skipOutfit(outfit.id, reason))}
          >
            {pending ? "Saving…" : "Skip this outfit"}
          </button>
        </div>
      )}
    </div>
  );
}
