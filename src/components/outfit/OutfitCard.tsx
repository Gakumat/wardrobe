import Link from "next/link";
import { FlatLay } from "@/components/flat-lay/FlatLay";
import type { OutfitView } from "@/lib/schema/outfit";

export function OutfitCard({ outfit }: { outfit: OutfitView }) {
  const date = new Date(outfit.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  return (
    <Link href={`/outfit/${outfit.id}`} className="block">
      <FlatLay pieces={outfit.pieces} className="rounded-2xl" />
      <p className="mt-1.5 truncate text-sm font-medium">{outfit.explanation?.title ?? "Outfit"}</p>
      <p className="text-xs text-muted">
        {date}
        {outfit.status === "worn" && " · worn"}
        {outfit.favourite && " · ♥"}
      </p>
    </Link>
  );
}
