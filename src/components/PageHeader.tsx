import Link from "next/link";
import { Icon } from "./Icon";

export function PageHeader({
  title,
  subtitle,
  back,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-3 px-5 pb-4 pt-6">
      <div className="min-w-0">
        {back && (
          <Link href={back} className="mb-2 inline-flex items-center gap-1 text-sm text-muted">
            <Icon name="back" className="h-4 w-4" /> Back
          </Link>
        )}
        <h1 className="truncate font-serif text-4xl leading-none">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}
