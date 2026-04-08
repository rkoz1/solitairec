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
    const { eventName, eventId, eventData, eventSourceUrl, userEmail, userPhone, externalId, firstName, lastName, fbc: bodyFbc, fbp: bodyFbp } = body as {
      eventName: string;
      eventId: string;
      eventData: {
        value?: number;
        currency?: string;
        contentIds?: string[];
        contentName?: string;
        contentType?: string;
        numItems?: number;
        orderId?: string;
        searchString?: string;
      };
      eventSourceUrl?: string;
      userEmail?: string;
      userPhone?: string;
      externalId?: string;
      firstName?: string;
      lastName?: string;
      fbc?: string;
      fbp?: string;
    };

    if (!eventName || !eventId) {
      return NextResponse.json({ error: "Missing eventName or eventId" }, { status: 400 });
    }

    // Read server-side signals
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() ?? "";
    const userAgent = request.headers.get("user-agent") ?? "";

    // Read _fbc and _fbp: prefer body overrides (preserved pre-redirect), fall back to cookies
    const cookieHeader = request.headers.get("cookie") ?? "";
    const fbc = bodyFbc || parseCookie(cookieHeader, "_fbc");
    const fbp = bodyFbp || parseCookie(cookieHeader, "_fbp");

    // Fire-and-forget to Meta CAPI
    sendCapiEvent(
      eventName,
      eventId,
      eventData,
      {
        email: userEmail,
        phone: userPhone,
        firstName,
        lastName,
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
