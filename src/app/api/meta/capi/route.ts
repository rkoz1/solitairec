import { NextResponse } from "next/server";
import { sendCapiEvent } from "@/lib/meta-capi";

/**
 * CAPI relay endpoint — receives event data from the browser client,
 * enriches with server-side signals (IP, UA, fbc/fbp cookies),
 * and forwards to Meta Conversions API.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { eventName, eventId, eventData, eventSourceUrl, userEmail, externalId } = body as {
      eventName: string;
      eventId: string;
      eventData: {
        value?: number;
        currency?: string;
        contentIds?: string[];
        contentName?: string;
        contentType?: string;
        numItems?: number;
        searchString?: string;
      };
      eventSourceUrl?: string;
      userEmail?: string;
      externalId?: string;
    };

    if (!eventName || !eventId) {
      return NextResponse.json({ error: "Missing eventName or eventId" }, { status: 400 });
    }

    // Read server-side signals
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() ?? "";
    const userAgent = request.headers.get("user-agent") ?? "";

    // Read _fbc and _fbp cookies
    const cookieHeader = request.headers.get("cookie") ?? "";
    const fbc = parseCookie(cookieHeader, "_fbc");
    const fbp = parseCookie(cookieHeader, "_fbp");

    // Fire-and-forget to Meta CAPI
    sendCapiEvent(
      eventName,
      eventId,
      eventData,
      {
        email: userEmail,
        externalId,
        ip,
        userAgent,
        fbc,
        fbp,
      },
      eventSourceUrl
    ).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

function parseCookie(header: string, name: string): string | undefined {
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match?.[1] || undefined;
}
