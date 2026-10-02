import { PageHeader } from "@/components/PageHeader";
import { DayChat } from "@/components/chat/DayChat";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: prefs } = await supabase.from("preferences").select("location_name, lat, lon").maybeSingle();
  const fallback =
    prefs?.lat != null && prefs?.lon != null
      ? { lat: prefs.lat, lon: prefs.lon, name: prefs.location_name ?? "Home" }
      : null;
  return (
    <>
      <PageHeader title="Your day" subtitle="Type or speak. Refine until it's right." back="/" />
      <DayChat fallback={fallback} />
    </>
  );
}
