import { BottomNav } from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pt-safe mx-auto min-h-dvh max-w-xl pb-28">{children}</div>
      <BottomNav />
    </>
  );
}
