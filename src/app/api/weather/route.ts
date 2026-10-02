import { NextResponse, type NextRequest } from "next/server";
import { FALLBACK_LOCATION } from "@/lib/config";
import { fetchDay } from "@/lib/weather";

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat") ?? FALLBACK_LOCATION.lat);
  const lon = Number(req.nextUrl.searchParams.get("lon") ?? FALLBACK_LOCATION.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "Bad coordinates" }, { status: 400 });
  }
  try {
    return NextResponse.json(await fetchDay(lat, lon));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
