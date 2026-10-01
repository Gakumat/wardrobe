import Link from "next/link";
import { Icon } from "@/components/Icon";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const today = new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <>
      <PageHeader
        title="Today"
        subtitle={today}
        right={
          <Link href="/settings" aria-label="Settings" className="p-2 text-muted">
            <Icon name="gear" className="h-6 w-6" />
          </Link>
        }
      />
      <section className="px-5">
        <div className="card p-6 text-sm text-muted">
          You&apos;re signed in. Outfits arrive once your wardrobe is added.
        </div>
      </section>
    </>
  );
}
