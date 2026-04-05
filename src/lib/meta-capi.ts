/**
 * Server-side Meta Conversions API helper.
 * No-ops when META_CAPI_TOKEN is not set (dev mode).
 */

import { createHash } from "crypto";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_CAPI_TOKEN;
const API_VERSION = "v21.0";

function hashSha256(value: string): string {
  return createHash("sha256").update(value.toLowerCase().trim()).digest("hex");
}

interface CapiEventData {
  value?: number;
  currency?: string;
  contentIds?: string[];
  contentName?: string;
  contentType?: string;
  orderId?: string;
  numItems?: number;
  searchString?: string;
}

interface UserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  externalId?: string;
  ip?: string;
  userAgent?: string;
  fbc?: string;
  fbp?: string;
}

export async function sendCapiEvent(
  eventName: string,
  eventId: string,
  eventData: CapiEventData,
  userData: UserData,
  eventSourceUrl?: string
): Promise<void> {
  if (!PIXEL_ID || !ACCESS_TOKEN) return;

  const event: Record<string, unknown> = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: "website",
    ...(eventSourceUrl ? { event_source_url: eventSourceUrl } : {}),
    user_data: {
      ...(userData.email ? { em: [hashSha256(userData.email)] } : {}),
      ...(userData.phone ? { ph: [hashSha256(userData.phone.replace(/\D/g, ""))] } : {}),
      ...(userData.firstName ? { fn: [hashSha256(userData.firstName)] } : {}),
      ...(userData.lastName ? { ln: [hashSha256(userData.lastName)] } : {}),
      ...(userData.externalId ? { external_id: [hashSha256(userData.externalId)] } : {}),
      ...(userData.ip ? { client_ip_address: userData.ip } : {}),
      ...(userData.userAgent
        ? { client_user_agent: userData.userAgent }
        : {}),
      ...(userData.fbc ? { fbc: userData.fbc } : {}),
      ...(userData.fbp ? { fbp: userData.fbp } : {}),
    },
    custom_data: {
      ...(eventData.value !== undefined ? { value: eventData.value } : {}),
      ...(eventData.currency ? { currency: eventData.currency } : {}),
      ...(eventData.contentIds
        ? { content_ids: eventData.contentIds }
        : {}),
      ...(eventData.contentName
        ? { content_name: eventData.contentName }
        : {}),
      ...(eventData.contentType
        ? { content_type: eventData.contentType }
        : {}),
      ...(eventData.orderId ? { order_id: eventData.orderId } : {}),
      ...(eventData.numItems !== undefined
        ? { num_items: eventData.numItems }
        : {}),
      ...(eventData.searchString
        ? { search_string: eventData.searchString }
        : {}),
    },
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [event] }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("[Meta CAPI] Error:", res.status, text);
    }
  } catch (err) {
    console.error("[Meta CAPI] Failed to send event:", err);
  }
}
