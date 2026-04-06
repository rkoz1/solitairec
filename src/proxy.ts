import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_MAX_AGE = 90 * 24 * 60 * 60; // 90 days — matches Meta SDK

/**
 * Server-side _fbc / _fbp cookie management.
 * Mirrors Meta's capi-param-builder SDK behaviour so CAPI has Click ID
 * and Browser ID even when the Meta Pixel JS is blocked by ad blockers.
 *
 * Key behaviours copied from Meta's SDK:
 *  - Extract fbclid from both URL params and Referer header
 *  - Only overwrite _fbc when the fbclid payload actually changes
 *  - Set cookie domain to ETLD+1 for cross-subdomain sharing
 *  - Use subdomain_index based on domain structure
 *  - Random _fbp uses Math.random() * 2147483647 (matches Meta SDK range)
 */
export function proxy(request: NextRequest) {
  const existingFbc = request.cookies.get("_fbc")?.value;
  const existingFbp = request.cookies.get("_fbp")?.value;

  // Check URL params first, then Referer header (Meta SDK does both)
  let fbclid = request.nextUrl.searchParams.get("fbclid");
  if (!fbclid) {
    const referer = request.headers.get("referer");
    if (referer) {
      try {
        fbclid = new URL(referer).searchParams.get("fbclid");
      } catch { /* invalid referer URL */ }
    }
  }

  // Nothing to do if both cookies exist and no new fbclid
  if (!fbclid && existingFbc && existingFbp) return NextResponse.next();

  // If fbclid matches existing _fbc payload, skip overwrite (Meta SDK behaviour)
  if (fbclid && existingFbc) {
    const existingPayload = existingFbc.split(".")[3];
    if (existingPayload === fbclid) fbclid = null;
  }

  // Nothing to set
  if (!fbclid && existingFbp) return NextResponse.next();

  const response = NextResponse.next();
  const now = Date.now();
  const host = request.headers.get("host") ?? "";
  const domain = getEtldPlus1(host);
  const subdomainIndex = domain.split(".").length - 1;

  const cookieOpts = {
    maxAge: COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax" as const,
    secure: true,
    ...(domain && !isIPAddress(domain) ? { domain: `.${domain}` } : {}),
  };

  if (fbclid) {
    response.cookies.set("_fbc", `fb.${subdomainIndex}.${now}.${fbclid}`, cookieOpts);
  }

  if (!existingFbp) {
    const randomId = Math.floor(Math.random() * 2147483647);
    response.cookies.set("_fbp", `fb.${subdomainIndex}.${now}.${randomId}`, cookieOpts);
  }

  return response;
}

/** Extract ETLD+1 from host (e.g. "www.solitairec.com" → "solitairec.com") */
function getEtldPlus1(host: string): string {
  // Strip port
  const hostname = host.replace(/:\d+$/, "");
  if (isIPAddress(hostname)) return hostname;
  const parts = hostname.split(".");
  // For standard domains, take last 2 parts
  return parts.length > 2 ? parts.slice(-2).join(".") : hostname;
}

function isIPAddress(value: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(value) || value.includes(":");
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
