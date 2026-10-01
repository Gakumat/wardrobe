"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { deleteItem } from "@/lib/items/actions";
import type { ItemWithUrls } from "@/lib/schema/item";
import { ItemEditor } from "./ItemEditor";

export function ItemDetail({ item }: { item: ItemWithUrls }) {
  const router = useRouter();
  const [showOriginal, setShowOriginal] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, start] = useTransition();
  const src = showOriginal ? item.original_url : item.cutout_url;

  return (
    <section className="space-y-6 px-5">
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-3xl bg-flatlay p-6">
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={item.name ?? ""}
            className={showOriginal ? "h-full w-full object-cover" : "max-h-full max-w-full object-contain"}
          />
        )}
        {item.original_url && item.photo_cutout && (
          <button
            onClick={() => setShowOriginal((s) => !s)}
            className="chip absolute bottom-3 right-3 bg-surface/90"
          >
            {showOriginal ? "Show cut-out" : "Show photo"}
          </button>
        )}
      </div>

      <ItemEditor
        key={item.updated_at}
        item={item}
        saveLabel={saved ? "Saved ✓" : "Save changes"}
        onDone={() => {
          setSaved(true);
          router.refresh();
          setTimeout(() => setSaved(false), 2000);
        }}
      />

      <button
        className="btn-ghost w-full text-warn"
        disabled={deleting}
        onClick={() => {
          if (!confirm("Delete this item and its photos? Outfits that used it will lose it.")) return;
          start(async () => {
            await deleteItem(item.id);
            router.push("/wardrobe");
          });
        }}
      >
        <Icon name="trash" className="h-4 w-4" /> {deleting ? "Deleting…" : "Delete item"}
      </button>
    </section>
  );
}
