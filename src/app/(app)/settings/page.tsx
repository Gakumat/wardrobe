import { PageHeader } from "@/components/PageHeader";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { signOut } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("preferences")
    .select("likes, dislikes, learned, location_name, lat, lon, model")
    .maybeSingle();

  return (
    <>
      <PageHeader title="Settings" subtitle={user?.email} back="/" />
      <section className="space-y-6 px-5">
        <SettingsForm
          prefs={{
            likes: data?.likes ?? "",
            dislikes: data?.dislikes ?? "",
            learned: data?.learned ?? [],
            location_name: data?.location_name ?? null,
            lat: data?.lat ?? null,
            lon: data?.lon ?? null,
            model: data?.model ?? null,
          }}
        />
        <form action={signOut}>
          <button className="btn-ghost w-full">Sign out</button>
        </form>
      </section>
    </>
  );
}
