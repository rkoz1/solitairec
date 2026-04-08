import { NextResponse } from "next/server";

/**
 * Debug endpoint — returns server-side tracking signals.
 * Shows what CAPI would see for the current request.
 */
export async function GET(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? "";
  const userAgent = request.headers.get("user-agent") ?? "";

  const cookieHeader = request.headers.get("cookie") ?? "";
  const fbc = cookieHeader.match(/(?:^|;\s*)_fbc=([^;]*)/)?.[1] ?? null;
  const fbp = cookieHeader.match(/(?:^|;\s*)_fbp=([^;]*)/)?.[1] ?? null;

  return NextResponse.json({
    ip,
    userAgent,
    fbc,
    fbp,
    capiConfigured: !!process.env.META_CAPI_TOKEN,
    pixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID ?? null,
    clarityId: process.env.NEXT_PUBLIC_CLARITY_ID ?? null,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? null,
    webhookSecretSet: !!process.env.WIX_WEBHOOK_SECRET,
  });
}
