"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { redoCutout, rotateItem, revertToOriginalPhoto } from "@/lib/items/upload";
import type { Item } from "@/lib/schema/item";

/** Rotate / redo cut-out / fall back to the original photo. */
export function PhotoTools({ item }: { item: Pick<Item, "id" | "photo_original" | "photo_cutout"> }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError(undefined);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };

  const btn = "chip gap-1.5 py-1.5 disabled:opacity-50";
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        <button className={btn} disabled={!!busy} onClick={() => run("rotate", () => rotateItem(item))}>
          <Icon name="refresh" className="h-3.5 w-3.5" /> {busy === "rotate" ? "Rotating…" : "Rotate"}
        </button>
        <button className={btn} disabled={!!busy} onClick={() => run("cutout", () => redoCutout(item))}>
          <Icon name="sparkle" className="h-3.5 w-3.5" />
          {busy === "cutout" ? "Cutting out…" : item.photo_cutout ? "Redo cut-out" : "Make cut-out"}
        </button>
        {item.photo_cutout && (
          <button
            className={btn}
            disabled={!!busy}
            onClick={() => run("original", () => revertToOriginalPhoto(item))}
          >
            <Icon name="camera" className="h-3.5 w-3.5" /> {busy === "original" ? "…" : "Use photo"}
          </button>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-warn">{error}</p>}
    </div>
  );
}
