import { appIcon } from "@/lib/appIcon";

// /icons/192, /icons/512, /icons/maskable-512 for the web app manifest.
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const maskable = size.startsWith("maskable-");
  const px = Number(size.replace("maskable-", ""));
  if (![192, 512].includes(px)) return new Response("Not found", { status: 404 });
  return appIcon(px, { padded: maskable });
}
