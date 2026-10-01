import { PageHeader } from "@/components/PageHeader";
import { signOut } from "@/app/login/actions";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" back="/" />
      <section className="space-y-4 px-5">
        <form action={signOut}>
          <button className="btn-ghost w-full">Sign out</button>
        </form>
      </section>
    </>
  );
}
